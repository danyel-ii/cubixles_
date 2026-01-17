// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title CubixlesBuilderMinter
/// @notice Builder minting contract that routes mint fees to ERC-2981 creators.
/// @dev Requires references to support ERC-721 + ERC-2981 and be owned by the minter.
/// @author cubixles_
contract CubixlesBuilderMinter is ERC721, Ownable, ReentrancyGuard, EIP712 {
    /// @notice Reference to an ERC-721 token used for a cube face.
    struct NftRef {
        address contractAddress;
        uint256 tokenId;
    }

    /// @notice Signed quote for builder mint pricing.
    struct BuilderQuote {
        uint256 totalFloorWei;
        uint256 chainId;
        uint256 expiresAt;
        uint256 nonce;
    }

    /// @notice Reference count is invalid.
    error InvalidReferenceCount(uint256 count);
    /// @notice Mint price mismatch.
    error InvalidMintPrice(uint256 expected, uint256 received);
    /// @notice Quote signer is required.
    error QuoteSignerRequired();
    /// @notice Quote signer does not match.
    error InvalidQuoteSigner(address signer);
    /// @notice Quote chainId mismatch.
    error QuoteChainIdMismatch(uint256 expected, uint256 actual);
    /// @notice Quote has expired.
    error QuoteExpired(uint256 expiresAt, uint256 currentTime);
    /// @notice Quote nonce already used.
    error QuoteNonceUsed(uint256 nonce);
    /// @notice Floor entries length mismatch.
    error InvalidFloorCount(uint256 expected, uint256 actual);
    /// @notice Total floor sum mismatch.
    error QuoteTotalFloorMismatch(uint256 expected, uint256 actual);
    /// @notice Zero address is not allowed.
    error ZeroAddress();
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

    /// @notice Minimum floor price per face (0.001 ETH).
    uint256 public constant MIN_FLOOR_WEI = 1_000_000_000_000_000;
    /// @notice Mint price factor in basis points (10%).
    uint16 public constant PRICE_BPS = 1_000;
    /// @notice Royalty share per face in basis points (12%).
    uint16 public constant BUILDER_BPS = 1_200;
    /// @notice Basis points denominator.
    uint16 public constant BPS = 10_000;
    /// @notice Maximum number of references allowed.
    uint256 public constant MAX_REFERENCES = 6;
    /// @notice Typehash for NftRef.
    bytes32 public constant REF_TYPEHASH =
        keccak256("NftRef(address contractAddress,uint256 tokenId)");
    /// @notice Typehash for BuilderQuote.
    bytes32 public constant QUOTE_TYPEHASH =
        keccak256(
            "BuilderQuote(bytes32 refsHash,bytes32 floorsHash,uint256 totalFloorWei,uint256 chainId,uint256 expiresAt,uint256 nonce)"
        );

    /// @notice Total minted token count.
    uint256 public totalMinted;
    /// @notice Authorized signer for floor quotes.
    address public quoteSigner;
    /// @notice Pending owner balance when direct payouts fail.
    uint256 public pendingOwnerBalance;
    /// @notice Base token URI.
    string private _baseTokenURI;
    /// @notice References used per token id.
    mapping(uint256 => NftRef[]) private _refsByTokenId;
    /// @notice Used quote nonces.
    mapping(uint256 => bool) public usedNonces;

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
    /// @notice Emitted when the quote signer is updated.
    event QuoteSignerUpdated(address indexed signer);
    /// @notice Emitted when owner balance is accrued.
    event OwnerBalanceAccrued(uint256 amount);
    /// @notice Emitted when owner balance is withdrawn.
    event OwnerBalanceWithdrawn(address indexed to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseUri_
    ) ERC721(name_, symbol_) Ownable(msg.sender) EIP712("CubixlesBuilderMinter", "1") {
        _baseTokenURI = baseUri_;
    }

    /// @notice Mint with ERC-2981 references and route 12% per face to creators.
    /// @param refs References used for the cube faces (1-6).
    /// @param floorsWei Floor prices (wei) aligned to refs order.
    /// @param quote Signed quote containing total floor sum and expiry.
    /// @param signature Signature from the quote signer.
    function mintBuilders(
        NftRef[] calldata refs,
        uint256[] calldata floorsWei,
        BuilderQuote calldata quote,
        bytes calldata signature
    ) external payable nonReentrant returns (uint256 tokenId) {
        uint256 refCount = _requireValidRefCount(refs.length);
        _requireFloorCount(refCount, floorsWei.length);

        uint256 expectedTotalFloorWei = _computeTotalFloorWei(floorsWei, refCount);
        uint256 mintPrice = _validateQuote(refs, floorsWei, quote, signature, expectedTotalFloorWei);
        _requireExactPayment(mintPrice);

        address minter = msg.sender;
        address ownerAddr = owner();
        address[] memory receivers = _resolveReceivers(refs, minter, mintPrice);

        tokenId = _mintToken(minter, refs);
        _distributePayouts(mintPrice, floorsWei, receivers, ownerAddr);

        emit BuilderMinted(tokenId, minter, refCount, mintPrice);
    }

    /// @notice Return the references stored for a token id.
    function getTokenRefs(uint256 tokenId) external view returns (NftRef[] memory) {
        return _refsByTokenId[tokenId];
    }

    /// @notice Update base token URI.
    function setBaseURI(string calldata baseUri) external onlyOwner {
        _baseTokenURI = baseUri;
    }

    /// @notice Update the authorized quote signer.
    function setQuoteSigner(address signer) external onlyOwner {
        if (signer == address(0)) {
            revert ZeroAddress();
        }
        quoteSigner = signer;
        emit QuoteSignerUpdated(signer);
    }

    /// @notice Withdraw pending owner balance to a recipient.
    function withdrawOwnerBalance(address payable to) external onlyOwner nonReentrant {
        if (to == address(0)) {
            revert ZeroAddress();
        }
        uint256 amount = pendingOwnerBalance;
        if (amount == 0) {
            return;
        }
        pendingOwnerBalance = 0;
        Address.sendValue(to, amount);
        emit OwnerBalanceWithdrawn(to, amount);
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

    function _getRoyaltyReceiver(
        address nft,
        uint256 tokenId,
        uint256 salePrice
    ) internal view returns (address) {
        try IERC2981(nft).royaltyInfo(tokenId, salePrice) returns (
            address receiver,
            uint256 royaltyAmount
        ) {
            if (receiver == address(0)) {
                revert RoyaltyReceiverRequired(nft, tokenId);
            }
            if (royaltyAmount == 0) {
                // Intentional no-op to document the ignored amount.
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

    function _requireValidRefCount(uint256 refCount) internal pure returns (uint256) {
        if (refCount == 0 || refCount > MAX_REFERENCES) {
            revert InvalidReferenceCount(refCount);
        }
        return refCount;
    }

    function _requireFloorCount(uint256 refCount, uint256 floorCount) internal pure {
        if (floorCount != refCount) {
            revert InvalidFloorCount(refCount, floorCount);
        }
    }

    function _requireExactPayment(uint256 mintPrice) internal view {
        if (msg.value != mintPrice) {
            revert InvalidMintPrice(mintPrice, msg.value);
        }
    }

    function _validateQuote(
        NftRef[] calldata refs,
        uint256[] calldata floorsWei,
        BuilderQuote calldata quote,
        bytes calldata signature,
        uint256 expectedTotalFloorWei
    ) internal returns (uint256 mintPrice) {
        if (quoteSigner == address(0)) {
            revert QuoteSignerRequired();
        }
        if (quote.chainId != block.chainid) {
            revert QuoteChainIdMismatch(block.chainid, quote.chainId);
        }
        if (quote.expiresAt < block.timestamp) {
            revert QuoteExpired(quote.expiresAt, block.timestamp);
        }
        if (usedNonces[quote.nonce]) {
            revert QuoteNonceUsed(quote.nonce);
        }
        if (expectedTotalFloorWei != quote.totalFloorWei) {
            revert QuoteTotalFloorMismatch(expectedTotalFloorWei, quote.totalFloorWei);
        }

        bytes32 digest = _hashQuote(refs, floorsWei, quote);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != quoteSigner) {
            revert InvalidQuoteSigner(recovered);
        }
        usedNonces[quote.nonce] = true;

        return Math.mulDiv(quote.totalFloorWei, PRICE_BPS, BPS);
    }

    function _resolveReceivers(
        NftRef[] calldata refs,
        address expectedOwner,
        uint256 mintPrice
    ) internal view returns (address[] memory receivers) {
        uint256 refCount = refs.length;
        receivers = new address[](refCount);
        for (uint256 i = 0; i < refCount; i += 1) {
            NftRef calldata ref = refs[i];
            _requireInterfaces(ref.contractAddress);
            _requireOwner(ref.contractAddress, ref.tokenId, expectedOwner);
            receivers[i] = _getRoyaltyReceiver(ref.contractAddress, ref.tokenId, mintPrice);
        }
    }

    function _mintToken(
        address minter,
        NftRef[] calldata refs
    ) internal returns (uint256 tokenId) {
        totalMinted += 1;
        tokenId = totalMinted;
        _safeMint(minter, tokenId);
        _storeRefs(tokenId, refs);
    }

    function _distributePayouts(
        uint256 mintPrice,
        uint256[] calldata floorsWei,
        address[] memory receivers,
        address ownerAddr
    ) internal {
        uint256 share = Math.mulDiv(mintPrice, BUILDER_BPS, BPS);
        uint256 remaining = mintPrice;
        for (uint256 i = 0; i < receivers.length; i += 1) {
            if (floorsWei[i] == 0) {
                continue;
            }
            remaining -= share;
            address receiver = receivers[i];
            bool paid = _sendValue(receiver, share);
            if (!paid) {
                _creditOwner(ownerAddr, share);
                emit BuilderPayout(receiver, share, true);
            } else {
                emit BuilderPayout(receiver, share, false);
            }
        }
        if (remaining > 0) {
            _creditOwner(ownerAddr, remaining);
        }
    }

    function _creditOwner(address ownerAddr, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        bool paid = _sendValue(ownerAddr, amount);
        if (!paid) {
            pendingOwnerBalance += amount;
            emit OwnerBalanceAccrued(amount);
        }
    }

    function _computeTotalFloorWei(
        uint256[] calldata floorsWei,
        uint256 refCount
    ) internal pure returns (uint256 total) {
        total = (MAX_REFERENCES - refCount) * MIN_FLOOR_WEI;
        for (uint256 i = 0; i < floorsWei.length; i += 1) {
            uint256 floor = floorsWei[i] == 0 ? MIN_FLOOR_WEI : floorsWei[i];
            total += floor;
        }
    }

    function _hashQuote(
        NftRef[] calldata refs,
        uint256[] calldata floorsWei,
        BuilderQuote calldata quote
    ) internal view returns (bytes32) {
        bytes32 refsHash = _hashRefs(refs);
        bytes32 floorsHash = _hashFloors(floorsWei);
        bytes32 structHash = keccak256(
            abi.encode(
                QUOTE_TYPEHASH,
                refsHash,
                floorsHash,
                quote.totalFloorWei,
                quote.chainId,
                quote.expiresAt,
                quote.nonce
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function _hashRefs(NftRef[] calldata refs) internal pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](refs.length);
        for (uint256 i = 0; i < refs.length; i += 1) {
            NftRef calldata ref = refs[i];
            hashes[i] = keccak256(
                abi.encode(REF_TYPEHASH, ref.contractAddress, ref.tokenId)
            );
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function _hashFloors(uint256[] calldata floorsWei) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(floorsWei));
    }
}
