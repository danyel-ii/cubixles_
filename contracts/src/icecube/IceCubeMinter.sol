// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20Minimal } from "../interfaces/IERC20Minimal.sol";

/// @title IceCubeMinter
/// @notice Mints cubeLess NFTs with provenance-bound refs and ERC-2981 royalties.
/// @dev Token IDs are derived from minter + salt + canonical refs hash.
contract IceCubeMinter is ERC721URIStorage, ERC2981, Ownable, ReentrancyGuard {
    /// @notice Reference to an ERC-721 token used for provenance.
    struct NftRef {
        address contractAddress;
        uint256 tokenId;
    }

    /// @notice ETH transfer failed.
    error EthTransferFailed(address recipient, uint256 amount);
    /// @notice Reference ownership check reverted.
    error RefOwnershipCheckFailed(address nft, uint256 tokenId);
    /// @notice Reference is not owned by expected minter.
    error RefNotOwned(address nft, uint256 tokenId, address expectedOwner, address actualOwner);

    /// @notice Default resale royalty in basis points (5%).
    uint96 public constant RESALE_ROYALTY_BPS_DEFAULT = 500; // 5%
    /// @notice Base mint price in wei.
    uint256 public constant BASE_PRICE_WEI = 1_500_000_000_000_000;
    /// @notice Price step for rounding in wei.
    uint256 public constant PRICE_STEP_WEI = 100_000_000_000_000;
    /// @notice Supply cap reference (1B tokens with 18 decimals).
    uint256 public constant ONE_BILLION = 1_000_000_000e18;
    /// @notice Fixed-point scale for WAD math.
    uint256 public constant WAD = 1e18;

    /// @notice LESS supply at mint time by tokenId.
    mapping(uint256 => uint256) private _mintSupply;
    /// @notice LESS supply at last transfer by tokenId.
    mapping(uint256 => uint256) private _lastSupply;

    /// @notice LESS token address.
    address public immutable lessToken;
    /// @notice Royalty receiver for ERC-2981.
    address public resaleSplitter;
    /// @notice Total minted count (monotonic).
    uint256 public totalMinted;
    /// @notice TokenId by sequential index (1-based).
    mapping(uint256 => uint256) public tokenIdByIndex;
    /// @notice Minter address per tokenId.
    mapping(uint256 => address) public minterByTokenId;

    /// @notice Emitted when a mint succeeds.
    event Minted(uint256 indexed tokenId, address indexed minter, bytes32 salt, bytes32 refsHash);
    /// @notice Emitted when mint supply snapshot is captured.
    event MintSupplySnapshotted(uint256 indexed tokenId, uint256 supply);
    /// @notice Emitted when last supply snapshot is updated.
    event LastSupplySnapshotted(uint256 indexed tokenId, uint256 supply);
    /// @notice Emitted when royalty receiver changes.
    event RoyaltyReceiverUpdated(address resaleSplitter);

    /// @notice Create a new minter instance.
    /// @param resaleSplitter_ Royalty receiver for ERC-2981.
    /// @param lessToken_ LESS token address.
    /// @param resaleRoyaltyBps Royalty rate in basis points.
    constructor(address resaleSplitter_, address lessToken_, uint96 resaleRoyaltyBps)
        ERC721("IceCube", "ICECUBE")
        Ownable(msg.sender)
    {
        require(resaleSplitter_ != address(0), "Resale splitter required");
        require(lessToken_ != address(0), "LESS token required");
        require(resaleRoyaltyBps <= 1000, "Royalty too high");
        resaleSplitter = resaleSplitter_;
        lessToken = lessToken_;

        _setDefaultRoyalty(resaleSplitter_, resaleRoyaltyBps);
    }

    /// @notice Mint a new NFT tied to provenance refs.
    /// @param salt User-provided salt for tokenId derivation.
    /// @param tokenURI IPFS metadata URI to store.
    /// @param refs Provenance references (1..6).
    /// @return tokenId Newly minted token ID.
    function mint(
        bytes32 salt,
        string calldata tokenURI,
        NftRef[] calldata refs
    ) external payable nonReentrant returns (uint256 tokenId) {
        // Revert if refs length is outside 1..6 to prevent ambiguous split math.
        require(refs.length >= 1 && refs.length <= 6, "Invalid reference count");

        for (uint256 i = 0; i < refs.length; i += 1) {
            try IERC721(refs[i].contractAddress).ownerOf(refs[i].tokenId) returns (
                address nftOwner
            ) {
                if (nftOwner != msg.sender) {
                    revert RefNotOwned(
                        refs[i].contractAddress,
                        refs[i].tokenId,
                        msg.sender,
                        nftOwner
                    );
                }
            } catch {
                revert RefOwnershipCheckFailed(refs[i].contractAddress, refs[i].tokenId);
            }
        }

        uint256 price = currentMintPrice();
        require(msg.value >= price, "INSUFFICIENT_ETH");

        bytes32 refsHash = _hashRefsCanonical(refs);
        tokenId = _computeTokenId(msg.sender, salt, refsHash);
        require(_ownerOf(tokenId) == address(0), "TOKENID_EXISTS");

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);
        totalMinted += 1;
        tokenIdByIndex[totalMinted] = tokenId;
        minterByTokenId[tokenId] = msg.sender;

        emit Minted(tokenId, msg.sender, salt, refsHash);

        _snapshotSupply(tokenId, true);
        _transferEth(owner(), price);

        if (msg.value > price) {
            _transferEth(msg.sender, msg.value - price);
        }
    }

    /// @notice Current mint price based on LESS total supply.
    function currentMintPrice() public view returns (uint256) {
        uint256 supply = IERC20Minimal(lessToken).totalSupply();
        if (supply > ONE_BILLION) {
            supply = ONE_BILLION;
        }
        uint256 delta = ONE_BILLION - supply;
        uint256 factorWad = WAD + (delta * WAD) / ONE_BILLION;
        uint256 rawPrice = (BASE_PRICE_WEI * factorWad) / WAD;
        return _roundUp(rawPrice, PRICE_STEP_WEI);
    }

    /// @notice Preview tokenId for the caller with the same derivation logic.
    /// @param salt User-provided salt.
    /// @param refs Provenance references to hash canonically.
    function previewTokenId(
        bytes32 salt,
        NftRef[] calldata refs
    ) external view returns (uint256) {
        bytes32 refsHash = _hashRefsCanonical(refs);
        return _computeTokenId(msg.sender, salt, refsHash);
    }

    /// @notice Current LESS total supply.
    function lessSupplyNow() public view returns (uint256) {
        return IERC20Minimal(lessToken).totalSupply();
    }

    /// @notice LESS supply captured at mint time.
    function mintSupplySnapshot(uint256 tokenId) external view returns (uint256) {
        return _mintSupply[tokenId];
    }

    /// @notice LESS supply captured at last transfer time.
    function lastSupplySnapshot(uint256 tokenId) external view returns (uint256) {
        return _lastSupply[tokenId];
    }

    /// @notice Supply delta (mint snapshot minus current).
    function deltaFromMint(uint256 tokenId) public view returns (uint256) {
        uint256 snapshot = _mintSupply[tokenId];
        uint256 supply = lessSupplyNow();
        if (supply >= snapshot) {
            return 0;
        }
        return snapshot - supply;
    }

    /// @notice Supply delta (last snapshot minus current).
    function deltaFromLast(uint256 tokenId) public view returns (uint256) {
        uint256 snapshot = _lastSupply[tokenId];
        uint256 supply = lessSupplyNow();
        if (supply >= snapshot) {
            return 0;
        }
        return snapshot - supply;
    }

    /// @notice Update the default royalty receiver.
    function setRoyaltyReceiver(address resaleSplitter_) external onlyOwner {
        require(resaleSplitter_ != address(0), "Resale splitter required");
        resaleSplitter = resaleSplitter_;
        _setDefaultRoyalty(resaleSplitter_, RESALE_ROYALTY_BPS_DEFAULT);

        emit RoyaltyReceiverUpdated(resaleSplitter_);
    }

    /// @notice Update the royalty rate and receiver.
    function setResaleRoyalty(uint96 bps, address receiver) external onlyOwner {
        require(receiver != address(0), "Receiver required");
        require(bps <= 1000, "Royalty too high");
        _setDefaultRoyalty(receiver, bps);
    }

    /// @notice ERC-165 support for ERC721URIStorage + ERC2981.
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @dev Snapshot LESS supply on secondary transfers.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from == address(0) || to == address(0)) {
            return from;
        }
        _snapshotSupply(tokenId, false);
    }

    /// @dev Send ETH and revert on failure.
    function _transferEth(address recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        (bool success, ) = recipient.call{ value: amount }("");
        if (!success) {
            revert EthTransferFailed(recipient, amount);
        }
    }

    /// @dev Canonicalize refs and hash for tokenId derivation.
    function _hashRefsCanonical(NftRef[] calldata refs) internal pure returns (bytes32) {
        NftRef[] memory sorted = new NftRef[](refs.length);
        for (uint256 i = 0; i < refs.length; i += 1) {
            sorted[i] = refs[i];
        }
        for (uint256 i = 1; i < sorted.length; i += 1) {
            NftRef memory key = sorted[i];
            uint256 j = i;
            while (j > 0 && _refLessThan(key, sorted[j - 1])) {
                sorted[j] = sorted[j - 1];
                j -= 1;
            }
            sorted[j] = key;
        }
        bytes memory packed = "";
        for (uint256 i = 0; i < sorted.length; i += 1) {
            packed = abi.encodePacked(packed, sorted[i].contractAddress, sorted[i].tokenId);
        }
        return keccak256(packed);
    }

    /// @dev Ordering by (contractAddress, tokenId) for canonicalization.
    function _refLessThan(NftRef memory a, NftRef memory b) internal pure returns (bool) {
        if (a.contractAddress < b.contractAddress) {
            return true;
        }
        if (a.contractAddress > b.contractAddress) {
            return false;
        }
        return a.tokenId < b.tokenId;
    }

    /// @dev Deterministic tokenId derivation.
    function _computeTokenId(
        address minter,
        bytes32 salt,
        bytes32 refsHash
    ) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked("cubeless:tokenid:v1", minter, salt, refsHash)));
    }

    /// @dev Round up to the nearest step.
    function _roundUp(uint256 value, uint256 step) internal pure returns (uint256) {
        if (value == 0) {
            return 0;
        }
        return ((value + step - 1) / step) * step;
    }

    /// @dev Record LESS supply snapshots and emit events.
    function _snapshotSupply(uint256 tokenId, bool isMint) internal {
        uint256 supply = IERC20Minimal(lessToken).totalSupply();
        if (isMint) {
            _mintSupply[tokenId] = supply;
            _lastSupply[tokenId] = supply;
            emit MintSupplySnapshotted(tokenId, supply);
        } else {
            _lastSupply[tokenId] = supply;
        }
        emit LastSupplySnapshotted(tokenId, supply);
    }
}
