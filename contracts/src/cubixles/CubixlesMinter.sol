// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IERC20Minimal } from "../interfaces/IERC20Minimal.sol";

/// @title CubixlesMinter
/// @notice Mints cubixles_ NFTs with provenance-bound refs and ERC-2981 royalties.
/// @dev Token IDs are derived from minter + salt + canonical refs hash.
/// @author cubixles_
contract CubixlesMinter is ERC721URIStorage, ERC2981, Ownable, ReentrancyGuard {
    /// @notice Reference to an ERC-721 token used for provenance.
    struct NftRef {
        address contractAddress;
        uint256 tokenId;
    }

    /// @notice Reference ownership check reverted.
    error RefOwnershipCheckFailed(address nft, uint256 tokenId);
    /// @notice Reference is not owned by expected minter.
    error RefNotOwned(address nft, uint256 tokenId, address expectedOwner, address actualOwner);
    /// @notice Resale splitter is required.
    error ResaleSplitterRequired();
    /// @notice LESS token is required.
    error LessTokenRequired();
    /// @notice Fixed mint price is required when LESS + linear pricing are disabled.
    error FixedPriceRequired();
    /// @notice Fixed price updates are not allowed when LESS or linear pricing is enabled.
    error FixedPriceNotAllowed();
    /// @notice Linear pricing config is required when enabled.
    error LinearPricingConfigRequired();
    /// @notice Linear pricing cannot be enabled when LESS pricing is active.
    error LinearPricingNotAllowed();
    /// @notice Royalty rate is too high.
    error RoyaltyTooHigh();
    /// @notice Mint commit is required.
    error MintCommitRequired();
    /// @notice Mint commit is expired.
    error MintCommitExpired();
    /// @notice Mint commit is for the current block.
    error MintCommitPendingBlock();
    /// @notice Provenance references length is invalid.
    error InvalidReferenceCount();
    /// @notice Mint cap reached.
    error MintCapReached();
    /// @notice ETH payment is insufficient.
    error InsufficientEth();
    /// @notice Commit refs hash mismatch.
    error MintCommitMismatch();
    /// @notice Commit salt mismatch.
    error MintCommitSaltMismatch();
    /// @notice TokenId already exists.
    error TokenIdExists();
    /// @notice Commit block hash not found.
    error MintCommitHashMissing();
    /// @notice Commit refs hash is empty.
    error MintCommitEmpty();
    /// @notice Commit already exists and is still active.
    error MintCommitActive();
    /// @notice Royalty receiver is required.
    error RoyaltyReceiverRequired();

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
    /// @notice Maximum number of mints allowed.
    uint256 public constant MAX_MINTS = 32_768;
    /// @notice Palette entries available for random draw.
    uint256 public constant PALETTE_SIZE = 10_000;
    /// @notice Commit expiry window (in blocks) for reveal.
    uint256 public constant COMMIT_EXPIRY_BLOCKS = 256;

    /// @notice Pending commit for commit-reveal minting.
    struct MintCommit {
        bytes32 refsHash;
        bytes32 salt;
        uint256 blockNumber;
    }

    /// @notice LESS supply at mint time by tokenId.
    mapping(uint256 => uint256) private _mintSupply;
    /// @notice LESS supply at last transfer by tokenId.
    mapping(uint256 => uint256) private _lastSupply;
    /// @notice Palette index selected at mint time by tokenId.
    mapping(uint256 => uint256) public paletteIndexByTokenId;
    /// @notice Pending commit per minter.
    mapping(address => MintCommit) public mintCommitByMinter;

    /// @notice LESS token address.
    // solhint-disable-next-line immutable-vars-naming
    address public immutable LESS_TOKEN; // slither-disable-line naming-convention,missing-zero-check
    // solhint-disable immutable-vars-naming
    /// @notice Whether LESS pricing + snapshots are enabled.
    bool public immutable lessEnabled;
    // solhint-enable immutable-vars-naming
    /// @notice Whether linear pricing is enabled.
    bool public immutable linearPricingEnabled;
    /// @notice Base mint price for linear pricing.
    uint256 public immutable baseMintPriceWei;
    /// @notice Price step per mint for linear pricing.
    uint256 public immutable baseMintPriceStepWei;
    /// @notice Fixed mint price when LESS + linear pricing are disabled.
    uint256 public fixedMintPriceWei;
    /// @notice Royalty receiver for ERC-2981.
    address public resaleSplitter;
    /// @notice Total minted count (monotonic).
    uint256 public totalMinted;
    /// @notice TokenId by sequential index (1-based).
    mapping(uint256 => uint256) public tokenIdByIndex;
    /// @notice Minter address per tokenId.
    mapping(uint256 => address) public minterByTokenId;
    /// @notice Mint price in wei recorded at mint time.
    mapping(uint256 => uint256) public mintPriceByTokenId;

    /// @notice Emitted when a mint succeeds.
    /// @param tokenId Minted token id.
    /// @param minter Wallet that minted.
    /// @param salt User-provided salt.
    /// @param refsHash Canonical refs hash.
    event Minted(uint256 indexed tokenId, address indexed minter, bytes32 salt, bytes32 refsHash);
    /// @notice Emitted when mint supply snapshot is captured.
    /// @param tokenId Minted token id.
    /// @param supply LESS total supply snapshot.
    event MintSupplySnapshotted(uint256 indexed tokenId, uint256 indexed supply);
    /// @notice Emitted when a mint commit is created.
    /// @param minter Wallet that committed.
    /// @param refsHash Canonical refs hash.
    /// @param salt User-provided salt.
    /// @param blockNumber Block number of the commit.
    event MintCommitCreated(
        address indexed minter,
        bytes32 indexed refsHash,
        bytes32 salt,
        uint256 indexed blockNumber
    );
    /// @notice Emitted when a palette index is assigned at mint.
    /// @param tokenId Minted token id.
    /// @param paletteIndex Random palette index assigned.
    event PaletteAssigned(uint256 indexed tokenId, uint256 indexed paletteIndex);
    /// @notice Emitted when last supply snapshot is updated.
    /// @param tokenId Token id updated.
    /// @param supply LESS total supply snapshot.
    event LastSupplySnapshotted(uint256 indexed tokenId, uint256 indexed supply);
    /// @notice Emitted when royalty receiver changes.
    /// @param resaleSplitter New royalty receiver.
    event RoyaltyReceiverUpdated(address indexed resaleSplitter);
    // solhint-disable gas-indexed-events
    /// @notice Emitted when fixed mint price is updated.
    /// @param price New fixed mint price in wei.
    event FixedMintPriceUpdated(uint256 price);
    // solhint-enable gas-indexed-events

    /// @notice Create a new minter instance.
    /// @param resaleSplitter_ Royalty receiver for ERC-2981.
    /// @param lessToken_ LESS token address.
    /// @param resaleRoyaltyBps Royalty rate in basis points.
    /// @param fixedMintPriceWei_ Fixed mint price when LESS is disabled.
    /// @param baseMintPriceWei_ Base mint price for linear pricing.
    /// @param baseMintPriceStepWei_ Price step per mint for linear pricing.
    /// @param linearPricingEnabled_ Whether linear pricing is enabled.
    constructor(
        address resaleSplitter_,
        address lessToken_,
        uint96 resaleRoyaltyBps,
        uint256 fixedMintPriceWei_,
        uint256 baseMintPriceWei_,
        uint256 baseMintPriceStepWei_,
        bool linearPricingEnabled_
    )
        ERC721("cubixles_", "cubixles_")
        Ownable(msg.sender)
    {
        if (resaleSplitter_ == address(0)) {
            revert ResaleSplitterRequired();
        }
        if (resaleRoyaltyBps > 1000) {
            revert RoyaltyTooHigh();
        }
        resaleSplitter = resaleSplitter_;
        // slither-disable-next-line missing-zero-check
        LESS_TOKEN = lessToken_;
        linearPricingEnabled = linearPricingEnabled_;
        baseMintPriceWei = baseMintPriceWei_;
        baseMintPriceStepWei = baseMintPriceStepWei_;
        if (lessToken_ != address(0)) {
            if (linearPricingEnabled_) {
                revert LinearPricingNotAllowed();
            }
            lessEnabled = true;
        } else {
            lessEnabled = false;
            if (linearPricingEnabled_) {
                if (baseMintPriceWei_ == 0 || baseMintPriceStepWei_ == 0) {
                    revert LinearPricingConfigRequired();
                }
            } else {
                if (fixedMintPriceWei_ == 0) {
                    revert FixedPriceRequired();
                }
                fixedMintPriceWei = fixedMintPriceWei_;
            }
        }

        _setDefaultRoyalty(resaleSplitter_, resaleRoyaltyBps);
    }

    /// @notice Mint a new NFT tied to provenance refs.
    /// @dev Requires a prior commit within the expiry window.
    /// @param salt User-provided salt for tokenId derivation.
    /// @param metadataURI IPFS metadata URI to store.
    /// @param refs Provenance references (1..6).
    /// @return tokenId Newly minted token ID.
    function mint(
        bytes32 salt,
        string calldata metadataURI,
        NftRef[] calldata refs
    ) external payable nonReentrant returns (uint256 tokenId) {
        MintCommit memory commit = mintCommitByMinter[msg.sender];
        _requireValidCommit(commit);
        _requireValidRefs(refs);
        if (!(totalMinted < MAX_MINTS)) {
            revert MintCapReached();
        }

        uint256 price = currentMintPrice();
        if (msg.value < price) {
            revert InsufficientEth();
        }

        bytes32 refsHash = _hashRefsCanonical(refs);
        if (refsHash != commit.refsHash) {
            revert MintCommitMismatch();
        }
        if (salt != commit.salt) {
            revert MintCommitSaltMismatch();
        }
        tokenId = _computeTokenId(msg.sender, salt, refsHash);
        if (_ownerOf(tokenId) != address(0)) {
            revert TokenIdExists();
        }

        uint256 paletteIndex = _assignPaletteIndex(refsHash, salt, msg.sender, commit.blockNumber);

        ++totalMinted;
        tokenIdByIndex[totalMinted] = tokenId;
        minterByTokenId[tokenId] = msg.sender;
        mintPriceByTokenId[tokenId] = price;
        paletteIndexByTokenId[tokenId] = paletteIndex;
        _setTokenURI(tokenId, metadataURI);
        _snapshotSupply(tokenId, true);
        delete mintCommitByMinter[msg.sender];

        _safeMint(msg.sender, tokenId);

        emit Minted(tokenId, msg.sender, salt, refsHash);
        emit PaletteAssigned(tokenId, paletteIndex);

        _transferEth(resaleSplitter, price);

        if (msg.value > price) {
            _transferEth(msg.sender, msg.value - price);
        }
    }

    /// @notice Commit a mint request for commit-reveal.
    /// @param salt User-provided salt for tokenId derivation.
    /// @param refsHash Canonical refs hash (sorted refs).
    function commitMint(bytes32 salt, bytes32 refsHash) external {
        if (refsHash == bytes32(0)) {
            revert MintCommitEmpty();
        }
        MintCommit memory existing = mintCommitByMinter[msg.sender];
        if (existing.blockNumber != 0) {
            if (!(block.number > existing.blockNumber + COMMIT_EXPIRY_BLOCKS)) {
                revert MintCommitActive();
            }
        }
        mintCommitByMinter[msg.sender] = MintCommit({
            refsHash: refsHash,
            salt: salt,
            blockNumber: block.number
        });
        emit MintCommitCreated(msg.sender, refsHash, salt, block.number);
    }

    /// @notice Current mint price for this deployment.
    /// @dev Linear pricing uses base + step * totalMinted. LESS pricing scales 1x→2x as supply drops.
    /// @return Current mint price in wei.
    function currentMintPrice() public view returns (uint256) {
        if (linearPricingEnabled) {
            return baseMintPriceWei + (baseMintPriceStepWei * totalMinted);
        }
        if (!lessEnabled) {
            return fixedMintPriceWei;
        }
        uint256 supply = IERC20Minimal(LESS_TOKEN).totalSupply();
        if (supply > ONE_BILLION) {
            supply = ONE_BILLION;
        }
        // Scale price by remaining supply so lower supply increases mint cost.
        uint256 delta = ONE_BILLION - supply;
        uint256 factorWad = WAD + (delta * WAD) / ONE_BILLION;
        uint256 rawPrice = (BASE_PRICE_WEI * factorWad) / WAD;
        return _roundUp(rawPrice, PRICE_STEP_WEI);
    }

    /// @notice Preview tokenId for the caller with the same derivation logic.
    /// @param salt User-provided salt.
    /// @param refs Provenance references to hash canonically.
    /// @return tokenId Deterministic token id for this input.
    function previewTokenId(
        bytes32 salt,
        NftRef[] calldata refs
    ) external view returns (uint256) {
        bytes32 refsHash = _hashRefsCanonical(refs);
        return _computeTokenId(msg.sender, salt, refsHash);
    }

    /// @notice Current LESS total supply.
    /// @return Current total supply from LESS token.
    function lessSupplyNow() public view returns (uint256) {
        if (!lessEnabled) {
            return 0;
        }
        return IERC20Minimal(LESS_TOKEN).totalSupply();
    }

    /// @notice LESS supply captured at mint time.
    /// @param tokenId Token id to read.
    /// @return LESS total supply snapshot at mint.
    function mintSupplySnapshot(uint256 tokenId) external view returns (uint256) {
        return _mintSupply[tokenId];
    }

    /// @notice LESS supply captured at last transfer time.
    /// @param tokenId Token id to read.
    /// @return LESS total supply snapshot at last transfer.
    function lastSupplySnapshot(uint256 tokenId) external view returns (uint256) {
        return _lastSupply[tokenId];
    }

    /// @notice Supply delta (mint snapshot minus current).
    /// @param tokenId Token id to read.
    /// @return Delta from mint snapshot.
    function deltaFromMint(uint256 tokenId) public view returns (uint256) {
        uint256 snapshot = _mintSupply[tokenId];
        uint256 supply = lessSupplyNow();
        if (supply < snapshot) {
            return snapshot - supply;
        }
        return 0;
    }

    /// @notice Supply delta (last snapshot minus current).
    /// @param tokenId Token id to read.
    /// @return Delta from last snapshot.
    function deltaFromLast(uint256 tokenId) public view returns (uint256) {
        uint256 snapshot = _lastSupply[tokenId];
        uint256 supply = lessSupplyNow();
        if (supply < snapshot) {
            return snapshot - supply;
        }
        return 0;
    }

    /// @notice Update the default royalty receiver.
    /// @param resaleSplitter_ Address to receive ERC-2981 royalties.
    function setRoyaltyReceiver(address resaleSplitter_) external onlyOwner {
        if (resaleSplitter_ == address(0)) {
            revert ResaleSplitterRequired();
        }
        resaleSplitter = resaleSplitter_;
        _setDefaultRoyalty(resaleSplitter_, RESALE_ROYALTY_BPS_DEFAULT);

        emit RoyaltyReceiverUpdated(resaleSplitter_);
    }

    /// @notice Update the royalty rate and receiver.
    /// @param bps New royalty bps (max 1000).
    /// @param receiver Receiver for ERC-2981 royalties.
    function setResaleRoyalty(uint96 bps, address receiver) external onlyOwner {
        if (receiver == address(0)) {
            revert RoyaltyReceiverRequired();
        }
        if (bps > 1000) {
            revert RoyaltyTooHigh();
        }
        _setDefaultRoyalty(receiver, bps);
    }

    /// @notice Update the fixed mint price (ETH-only mode).
    /// @param price New fixed mint price in wei.
    function setFixedMintPrice(uint256 price) external onlyOwner {
        if (lessEnabled || linearPricingEnabled) {
            revert FixedPriceNotAllowed();
        }
        if (price == 0) {
            revert FixedPriceRequired();
        }
        fixedMintPriceWei = price;
        emit FixedMintPriceUpdated(price);
    }

    /// @notice ERC-165 support for ERC721URIStorage + ERC2981.
    /// @param interfaceId Interface id to query.
    /// @return True if interface supported.
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
        Address.sendValue(payable(recipient), amount);
    }

    /// @dev Canonicalize refs and hash for tokenId derivation.
    function _hashRefsCanonical(NftRef[] calldata refs) internal pure returns (bytes32) {
        NftRef[] memory sorted = new NftRef[](refs.length);
        for (uint256 i = 0; i < refs.length; ++i) {
            sorted[i] = refs[i];
        }
        for (uint256 i = 1; i < sorted.length; ++i) {
            NftRef memory key = sorted[i];
            uint256 j = i;
            while (j > 0 && _refLessThan(key, sorted[j - 1])) {
                sorted[j] = sorted[j - 1];
                --j;
            }
            sorted[j] = key;
        }
        bytes memory packed = "";
        for (uint256 i = 0; i < sorted.length; ++i) {
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
        return uint256(keccak256(abi.encodePacked("cubixles_:tokenid:v1", minter, salt, refsHash)));
    }

    /// @dev Round up to the nearest step.
    function _roundUp(uint256 value, uint256 step) internal pure returns (uint256) {
        if (value == 0) {
            return 0;
        }
        uint256 rounded = Math.mulDiv(value + step - 1, 1, step);
        return Math.mulDiv(rounded, step, 1);
    }

    /// @dev Record LESS supply snapshots and emit events.
    function _snapshotSupply(uint256 tokenId, bool isMint) internal {
        uint256 supply = 0;
        if (lessEnabled) {
            supply = IERC20Minimal(LESS_TOKEN).totalSupply();
        }
        if (isMint) {
            _mintSupply[tokenId] = supply;
            _lastSupply[tokenId] = supply;
            emit MintSupplySnapshotted(tokenId, supply);
        } else {
            _lastSupply[tokenId] = supply;
        }
        emit LastSupplySnapshotted(tokenId, supply);
    }

    function _requireValidCommit(MintCommit memory commit) private view {
        if (commit.blockNumber == 0) {
            revert MintCommitRequired();
        }
        uint256 expiryBlock = commit.blockNumber + COMMIT_EXPIRY_BLOCKS;
        if (!(block.number < expiryBlock + 1)) {
            revert MintCommitExpired();
        }
        if (!(block.number > commit.blockNumber)) {
            revert MintCommitPendingBlock();
        }
    }

    function _requireValidRefs(NftRef[] calldata refs) private view {
        if (refs.length < 1 || refs.length > 6) {
            revert InvalidReferenceCount();
        }
        for (uint256 i = 0; i < refs.length; ++i) {
            // slither-disable-next-line calls-loop
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
    }

    function _assignPaletteIndex(
        bytes32 refsHash,
        bytes32 salt,
        address minter,
        uint256 commitBlockNumber
    ) private view returns (uint256) {
        bytes32 commitBlockHash = blockhash(commitBlockNumber);
        if (commitBlockHash == bytes32(0)) {
            revert MintCommitHashMissing();
        }
        // slither-disable-next-line weak-prng
        return uint256(
            keccak256(abi.encodePacked(refsHash, salt, minter, commitBlockNumber, commitBlockHash))
        ) % PALETTE_SIZE;
    }
}
