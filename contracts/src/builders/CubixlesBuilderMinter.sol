// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

/// @title CubixlesBuilderMinter
/// @notice Builder minting contract that routes mint fees to ERC-2981 creators.
/// @dev Requires references to support ERC-721 + ERC-2981 and be owned by the minter.
/// @author cubixles_
contract CubixlesBuilderMinter is ERC721, Ownable, ReentrancyGuard {
    /// @notice Reference to an ERC-721 token used for a cube face.
    struct NftRef {
        address contractAddress;
        uint256 tokenId;
    }

    /// @notice Reference count is invalid.
    error InvalidReferenceCount(uint256 count);
    /// @notice Mint price mismatch.
    error InvalidMintPrice(uint256 expected, uint256 received);
    /// @notice Reference does not support ERC-721.
    error ReferenceNotERC721(address nft);
    /// @notice Reference does not support ERC-2981.
    error ReferenceNotERC2981(address nft);
    /// @notice Reference ownership check reverted.
    error RefOwnershipCheckFailed(address nft, uint256 tokenId);
    /// @notice Reference is not owned by the minter.
    error RefNotOwned(address nft, uint256 tokenId, address expectedOwner, address actualOwner);
    /// @notice Royalty info call reverted.
    error RoyaltyInfoFailed(address nft, uint256 tokenId);
    /// @notice Royalty receiver is required.
    error RoyaltyReceiverRequired(address nft, uint256 tokenId);

    /// @notice Mint price for builder mints (0.0036 ETH).
    uint256 public constant MINT_PRICE_WEI = 3_600_000_000_000_000;
    /// @notice Royalty share per face in basis points (10%).
    uint16 public constant BUILDER_BPS = 1_000;
    /// @notice Basis points denominator.
    uint16 public constant BPS = 10_000;
    /// @notice Maximum number of references allowed.
    uint256 public constant MAX_REFERENCES = 6;

    /// @notice Total minted token count.
    uint256 public totalMinted;
    /// @notice Base token URI.
    string private _baseTokenURI;
    /// @notice References used per token id.
    mapping(uint256 => NftRef[]) private _refsByTokenId;

    /// @notice Emitted when a builder mint succeeds.
    /// @param tokenId Minted token id.
    /// @param minter Wallet that minted.
    /// @param refCount Number of references used.
    /// @param mintPrice Mint price paid.
    event BuilderMinted(
        uint256 indexed tokenId,
        address indexed minter,
        uint256 refCount,
        uint256 mintPrice
    );
    /// @notice Emitted when a builder payout is routed.
    /// @param receiver Intended royalty receiver.
    /// @param amount ETH amount routed.
    /// @param fallbackToOwner Whether payout fell back to the owner.
    event BuilderPayout(address indexed receiver, uint256 amount, bool fallbackToOwner);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseUri_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        _baseTokenURI = baseUri_;
    }

    /// @notice Mint with ERC-2981 references and route 10% per face to creators.
    /// @param refs References used for the cube faces (1-6).
    function mintBuilders(NftRef[] calldata refs) external payable nonReentrant returns (uint256 tokenId) {
        uint256 refCount = refs.length;
        if (refCount == 0 || refCount > MAX_REFERENCES) {
            revert InvalidReferenceCount(refCount);
        }
        if (msg.value != MINT_PRICE_WEI) {
            revert InvalidMintPrice(MINT_PRICE_WEI, msg.value);
        }

        address minter = msg.sender;
        address ownerAddr = owner();
        address[] memory receivers = new address[](refCount);

        for (uint256 i = 0; i < refCount; i += 1) {
            NftRef calldata ref = refs[i];
            _requireInterfaces(ref.contractAddress);
            _requireOwner(ref.contractAddress, ref.tokenId, minter);
            receivers[i] = _getRoyaltyReceiver(ref.contractAddress, ref.tokenId);
        }

        totalMinted += 1;
        tokenId = totalMinted;
        _safeMint(minter, tokenId);
        _storeRefs(tokenId, refs);

        uint256 share = (MINT_PRICE_WEI * BUILDER_BPS) / BPS;
        uint256 remaining = MINT_PRICE_WEI;
        for (uint256 i = 0; i < refCount; i += 1) {
            remaining -= share;
            address receiver = receivers[i];
            bool paid = _sendValue(receiver, share);
            if (!paid) {
                Address.sendValue(payable(ownerAddr), share);
                emit BuilderPayout(receiver, share, true);
            } else {
                emit BuilderPayout(receiver, share, false);
            }
        }
        if (remaining > 0) {
            Address.sendValue(payable(ownerAddr), remaining);
        }

        emit BuilderMinted(tokenId, minter, refCount, MINT_PRICE_WEI);
    }

    /// @notice Return the references stored for a token id.
    function getTokenRefs(uint256 tokenId) external view returns (NftRef[] memory) {
        return _refsByTokenId[tokenId];
    }

    /// @notice Update base token URI.
    function setBaseURI(string calldata baseUri) external onlyOwner {
        _baseTokenURI = baseUri;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _storeRefs(uint256 tokenId, NftRef[] calldata refs) internal {
        uint256 refCount = refs.length;
        for (uint256 i = 0; i < refCount; i += 1) {
            _refsByTokenId[tokenId].push(refs[i]);
        }
    }

    function _requireInterfaces(address nft) internal view {
        if (!_supportsInterface(nft, type(IERC721).interfaceId)) {
            revert ReferenceNotERC721(nft);
        }
        if (!_supportsInterface(nft, type(IERC2981).interfaceId)) {
            revert ReferenceNotERC2981(nft);
        }
    }

    function _supportsInterface(address nft, bytes4 interfaceId) internal view returns (bool) {
        try IERC165(nft).supportsInterface(interfaceId) returns (bool supported) {
            return supported;
        } catch {
            return false;
        }
    }

    function _requireOwner(address nft, uint256 tokenId, address expectedOwner) internal view {
        try IERC721(nft).ownerOf(tokenId) returns (address actualOwner) {
            if (actualOwner != expectedOwner) {
                revert RefNotOwned(nft, tokenId, expectedOwner, actualOwner);
            }
        } catch {
            revert RefOwnershipCheckFailed(nft, tokenId);
        }
    }

    function _getRoyaltyReceiver(address nft, uint256 tokenId) internal view returns (address) {
        try IERC2981(nft).royaltyInfo(tokenId, MINT_PRICE_WEI) returns (
            address receiver,
            uint256
        ) {
            if (receiver == address(0)) {
                revert RoyaltyReceiverRequired(nft, tokenId);
            }
            return receiver;
        } catch {
            revert RoyaltyInfoFailed(nft, tokenId);
        }
    }

    function _sendValue(address recipient, uint256 amount) internal returns (bool) {
        if (amount == 0) {
            return true;
        }
        (bool success, ) = payable(recipient).call{ value: amount }("");
        return success;
    }
}
