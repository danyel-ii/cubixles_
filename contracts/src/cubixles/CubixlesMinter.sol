// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IERC20Minimal } from "../interfaces/IERC20Minimal.sol";
import { VRFConsumerBaseV2 } from "../chainlink/VRFConsumerBaseV2.sol";
import { VRFCoordinatorV2Interface } from "../chainlink/VRFCoordinatorV2Interface.sol";

/// @title CubixlesMinter
/// @notice Mints cubixles_ NFTs with provenance-bound refs and ERC-2981 royalties.
/// @dev Token IDs are derived from minter + salt + canonical refs hash.
/// @author cubixles_
contract CubixlesMinter is ERC721, ERC2981, Ownable, ReentrancyGuard, VRFConsumerBaseV2 {
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
    /// @notice Commit randomness not fulfilled yet.
    error MintRandomnessPending();
    /// @notice TokenId already exists.
    error TokenIdExists();
    /// @notice Commit refs hash is empty.
    error MintCommitEmpty();
    /// @notice Commit already exists and is still active.
    error MintCommitActive();
    /// @notice Royalty receiver is required.
    error RoyaltyReceiverRequired();
    /// @notice Palette images CID is required.
    error PaletteImagesCidRequired();
    /// @notice Palette manifest hash is required.
    error PaletteManifestHashRequired();
    /// @notice Token URI is required.
    error TokenUriRequired();
    /// @notice Metadata hash is required.
    error MetadataHashRequired();
    /// @notice Image path hash is required.
    error ImagePathHashRequired();
    /// @notice Expected palette index does not match.
    error PaletteIndexMismatch(uint256 expected, uint256 actual);
    /// @notice Metadata commit is required.
    error MintMetadataCommitRequired();
    /// @notice Metadata commit already set.
    error MintMetadataCommitActive();
    /// @notice Metadata commit mismatch.
    error MintMetadataMismatch();
    /// @notice VRF coordinator is required.
    error VrfCoordinatorRequired();
    /// @notice VRF key hash is required.
    error VrfKeyHashRequired();
    /// @notice VRF subscription id is required.
    error VrfSubscriptionRequired();
    /// @notice VRF request confirmations required.
    error VrfRequestConfirmationsRequired();
    /// @notice VRF callback gas limit required.
    error VrfCallbackGasLimitRequired();

    /// @notice Default resale royalty in basis points (5%).
    uint96 public constant RESALE_ROYALTY_BPS_DEFAULT = 500; // 5%
    /// @notice Base mint price in wei.
    uint256 public constant BASE_PRICE_WEI = 2_200_000_000_000_000;
    /// @notice Price step for rounding in wei.
    uint256 public constant PRICE_STEP_WEI = 100_000_000_000_000;
    /// @notice Supply cap reference (1B tokens with 18 decimals).
    uint256 public constant ONE_BILLION = 1_000_000_000e18;
    /// @notice Fixed-point scale for WAD math.
    uint256 public constant WAD = 1e18;
    /// @notice Maximum number of mints allowed.
    uint256 public constant MAX_MINTS = 10_000;
    /// @notice Palette entries available for random draw.
    uint256 public constant PALETTE_SIZE = 10_000;
    /// @notice Commit reveal delay (in blocks).
    uint256 public constant COMMIT_REVEAL_DELAY_BLOCKS = 1;
    /// @notice Commit reveal window (in blocks).
    uint256 public constant COMMIT_REVEAL_WINDOW_BLOCKS = 256;
    /// @notice VRF random words requested per commit.
    uint32 public constant VRF_NUM_WORDS = 1;
    /// @notice Domain separator for commit hashes.
    string private constant COMMIT_DOMAIN = "cubixles_:commit:v1";

    /// @notice Pending commit for commit-reveal minting.
    struct MintCommit {
        bytes32 commitment;
        uint256 blockNumber;
        uint256 requestId;
        uint256 randomness;
        bool randomnessReady;
        uint256 paletteIndex;
        bool paletteAssigned;
        bytes32 metadataHash;
        bytes32 imagePathHash;
        bool metadataCommitted;
    }

    struct MintRequest {
        address minter;
        bytes32 commitment;
    }

    /// @notice LESS supply at mint time by tokenId.
    mapping(uint256 => uint256) private _mintSupply;
    /// @notice LESS supply at last transfer by tokenId.
    mapping(uint256 => uint256) private _lastSupply;
    /// @notice Palette index selected at mint time by tokenId.
    mapping(uint256 => uint256) public paletteIndexByTokenId;
    /// @notice Swap map for random-without-replacement palette draws.
    mapping(uint256 => uint256) private _paletteIndexSwap;
    /// @notice Pending commit per minter.
    mapping(address => MintCommit) public mintCommitByMinter;
    /// @notice Commit request tracking by VRF request id.
    mapping(uint256 => MintRequest) private _mintRequestById;

    /// @notice LESS token address.
    address public immutable LESS_TOKEN; /* solhint-disable-line immutable-vars-naming */ /* slither-disable-line naming-convention,missing-zero-check */
    /// @notice Whether LESS pricing + snapshots are enabled.
    bool public immutable lessEnabled; /* solhint-disable-line immutable-vars-naming */
    /// @notice Whether linear pricing is enabled.
    bool public immutable linearPricingEnabled; /* solhint-disable-line immutable-vars-naming */
    /// @notice Base mint price for linear pricing.
    uint256 public immutable baseMintPriceWei; /* solhint-disable-line immutable-vars-naming */
    /// @notice Price step per mint for linear pricing.
    uint256 public immutable baseMintPriceStepWei; /* solhint-disable-line immutable-vars-naming */
    /// @notice Fixed mint price when LESS + linear pricing are disabled.
    uint256 public fixedMintPriceWei;
    /// @notice Royalty receiver for ERC-2981.
    address public resaleSplitter;
    /// @notice Base CID for palette images.
    string public paletteImagesCID;
    /// @notice Hash or Merkle root for palette manifest.
    bytes32 public paletteManifestHash;
    /// @notice VRF coordinator contract.
    VRFCoordinatorV2Interface public immutable vrfCoordinator;
    /// @notice VRF key hash for randomness requests.
    bytes32 public immutable vrfKeyHash;
    /// @notice VRF subscription id.
    uint64 public immutable vrfSubscriptionId;
    /// @notice VRF request confirmations.
    uint16 public immutable vrfRequestConfirmations;
    /// @notice VRF callback gas limit.
    uint32 public immutable vrfCallbackGasLimit;
    /// @notice Total minted count (monotonic).
    uint256 public totalMinted;
    /// @notice Total palette indices reserved (monotonic).
    uint256 public totalAssigned;
    /// @notice TokenId by sequential index (1-based).
    mapping(uint256 => uint256) public tokenIdByIndex;
    /// @notice Minter address per tokenId.
    mapping(uint256 => address) public minterByTokenId;
    /// @notice Mint price in wei recorded at mint time.
    mapping(uint256 => uint256) public mintPriceByTokenId;
    /// @notice Token metadata URI per token.
    mapping(uint256 => string) private _tokenUriByTokenId;
    /// @notice Metadata hash per token.
    mapping(uint256 => bytes32) public metadataHashByTokenId;
    /// @notice Image path hash per token.
    mapping(uint256 => bytes32) public imagePathHashByTokenId;

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
    /// @param commitment Commitment hash.
    /// @param blockNumber Block number of the commit.
    /// @param requestId VRF request id.
    event MintCommitCreated(
        address indexed minter,
        bytes32 indexed commitment,
        uint256 indexed blockNumber,
        uint256 requestId
    );
    /// @notice Emitted when metadata is committed for a mint.
    /// @param minter Wallet that committed.
    /// @param metadataHash Hash of the canonical metadata payload.
    /// @param imagePathHash Hash of the palette image path.
    event MintMetadataCommitted(
        address indexed minter,
        bytes32 indexed metadataHash,
        bytes32 indexed imagePathHash
    );
    /// @notice Emitted when VRF randomness is fulfilled for a commit.
    /// @param minter Wallet that committed.
    /// @param requestId VRF request id.
    /// @param randomness Randomness delivered.
    event MintRandomnessFulfilled(
        address indexed minter,
        uint256 indexed requestId,
        uint256 randomness
    );
    /// @notice Emitted when a palette index is assigned at mint.
    /// @param tokenId Minted token id.
    /// @param paletteIndex Random palette index assigned.
    event PaletteAssigned(uint256 indexed tokenId, uint256 indexed paletteIndex);
    /// @notice Emitted when a token URI is set.
    /// @param tokenId Token id updated.
    /// @param tokenURI Token metadata URI.
    event TokenURIUpdated(uint256 indexed tokenId, string tokenURI);
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
    /// @param paletteImagesCID_ Base CID for palette images.
    /// @param paletteManifestHash_ Hash or Merkle root of palette manifest.
    /// @param vrfCoordinator_ Chainlink VRF coordinator address.
    /// @param vrfKeyHash_ Chainlink VRF key hash.
    /// @param vrfSubscriptionId_ Chainlink VRF subscription id.
    /// @param vrfRequestConfirmations_ Chainlink VRF request confirmations.
    /// @param vrfCallbackGasLimit_ Chainlink VRF callback gas limit.
    constructor(
        address resaleSplitter_,
        address lessToken_,
        uint96 resaleRoyaltyBps,
        uint256 fixedMintPriceWei_,
        uint256 baseMintPriceWei_,
        uint256 baseMintPriceStepWei_,
        bool linearPricingEnabled_,
        string memory paletteImagesCID_,
        bytes32 paletteManifestHash_,
        address vrfCoordinator_,
        bytes32 vrfKeyHash_,
        uint64 vrfSubscriptionId_,
        uint16 vrfRequestConfirmations_,
        uint32 vrfCallbackGasLimit_
    )
        ERC721("cubixles_", "cubixles_")
        Ownable(msg.sender)
        VRFConsumerBaseV2(vrfCoordinator_)
    {
        if (resaleSplitter_ == address(0)) {
            revert ResaleSplitterRequired();
        }
        if (resaleRoyaltyBps > 1000) {
            revert RoyaltyTooHigh();
        }
        if (bytes(paletteImagesCID_).length == 0) {
            revert PaletteImagesCidRequired();
        }
        if (paletteManifestHash_ == bytes32(0)) {
            revert PaletteManifestHashRequired();
        }
        if (vrfCoordinator_ == address(0)) {
            revert VrfCoordinatorRequired();
        }
        if (vrfKeyHash_ == bytes32(0)) {
            revert VrfKeyHashRequired();
        }
        if (vrfSubscriptionId_ == 0) {
            revert VrfSubscriptionRequired();
        }
        if (vrfRequestConfirmations_ == 0) {
            revert VrfRequestConfirmationsRequired();
        }
        if (vrfCallbackGasLimit_ == 0) {
            revert VrfCallbackGasLimitRequired();
        }
        resaleSplitter = resaleSplitter_;
        // slither-disable-next-line missing-zero-check
        LESS_TOKEN = lessToken_;
        linearPricingEnabled = linearPricingEnabled_;
        baseMintPriceWei = baseMintPriceWei_;
        baseMintPriceStepWei = baseMintPriceStepWei_;
        paletteImagesCID = paletteImagesCID_;
        paletteManifestHash = paletteManifestHash_;
        vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinator_);
        vrfKeyHash = vrfKeyHash_;
        vrfSubscriptionId = vrfSubscriptionId_;
        vrfRequestConfirmations = vrfRequestConfirmations_;
        vrfCallbackGasLimit = vrfCallbackGasLimit_;
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
    /// @dev Requires a prior commit within the reveal window.
    /// @param salt User-provided salt for tokenId derivation.
    /// @param refs Provenance references (1..6).
    /// @return tokenId Newly minted token ID.
    function mint(
        bytes32 salt,
        NftRef[] calldata refs,
        uint256 expectedPaletteIndex,
        string calldata tokenURI_,
        bytes32 metadataHash,
        bytes32 imagePathHash
    ) external payable nonReentrant returns (uint256 tokenId) {
        if (bytes(tokenURI_).length == 0) {
            revert TokenUriRequired();
        }
        if (metadataHash == bytes32(0)) {
            revert MetadataHashRequired();
        }
        if (imagePathHash == bytes32(0)) {
            revert ImagePathHashRequired();
        }
        _requireValidRefs(refs);
        if (!(totalMinted < MAX_MINTS)) {
            revert MintCapReached();
        }

        uint256 price = currentMintPrice();
        if (msg.value < price) {
            revert InsufficientEth();
        }

        bytes32 refsHash = _hashRefsCanonical(refs);
        uint256 paletteIndex = _consumeCommit(salt, refsHash, metadataHash, imagePathHash);
        tokenId = _computeTokenId(msg.sender, salt, refsHash);
        if (_ownerOf(tokenId) != address(0)) {
            revert TokenIdExists();
        }

        if (paletteIndex != expectedPaletteIndex) {
            revert PaletteIndexMismatch(expectedPaletteIndex, paletteIndex);
        }

        ++totalMinted;
        tokenIdByIndex[totalMinted] = tokenId;
        minterByTokenId[tokenId] = msg.sender;
        mintPriceByTokenId[tokenId] = price;
        paletteIndexByTokenId[tokenId] = paletteIndex;
        _tokenUriByTokenId[tokenId] = tokenURI_;
        metadataHashByTokenId[tokenId] = metadataHash;
        imagePathHashByTokenId[tokenId] = imagePathHash;
        _snapshotSupply(tokenId, true);

        _safeMint(msg.sender, tokenId);

        emit Minted(tokenId, msg.sender, salt, refsHash);
        emit PaletteAssigned(tokenId, paletteIndex);
        emit TokenURIUpdated(tokenId, tokenURI_);

        _transferEth(resaleSplitter, price);

        if (msg.value > price) {
            _transferEth(msg.sender, msg.value - price);
        }
    }

    /// @notice Commit a mint request for commit-reveal.
    /// @param commitment Commitment hash (minter + salt + refs hash).
    function commitMint(bytes32 commitment) external {
        if (commitment == bytes32(0)) {
            revert MintCommitEmpty();
        }
        MintCommit memory existing = mintCommitByMinter[msg.sender];
        if (existing.blockNumber != 0) {
            if (_isCommitActive(existing.blockNumber)) {
                revert MintCommitActive();
            }
        }
        if (!(totalAssigned < MAX_MINTS)) {
            revert MintCapReached();
        }
        uint256 requestId = vrfCoordinator.requestRandomWords(
            vrfKeyHash,
            vrfSubscriptionId,
            vrfRequestConfirmations,
            vrfCallbackGasLimit,
            VRF_NUM_WORDS
        );
        mintCommitByMinter[msg.sender] = MintCommit({
            commitment: commitment,
            blockNumber: block.number,
            requestId: requestId,
            randomness: 0,
            randomnessReady: false,
            paletteIndex: 0,
            paletteAssigned: false,
            metadataHash: bytes32(0),
            imagePathHash: bytes32(0),
            metadataCommitted: false
        });
        _mintRequestById[requestId] = MintRequest({ minter: msg.sender, commitment: commitment });
        emit MintCommitCreated(msg.sender, commitment, block.number, requestId);
    }

    /// @notice Commit metadata hashes after randomness is fulfilled.
    /// @param metadataHash Hash of the canonical metadata JSON.
    /// @param imagePathHash Hash of the palette image path (relative to paletteImagesCID).
    function commitMetadata(bytes32 metadataHash, bytes32 imagePathHash) external {
        if (metadataHash == bytes32(0)) {
            revert MetadataHashRequired();
        }
        if (imagePathHash == bytes32(0)) {
            revert ImagePathHashRequired();
        }
        MintCommit storage commit = mintCommitByMinter[msg.sender];
        _requireValidCommit(commit);
        if (!commit.randomnessReady) {
            revert MintRandomnessPending();
        }
        if (!commit.paletteAssigned) {
            revert MintCapReached();
        }
        if (commit.metadataCommitted) {
            revert MintMetadataCommitActive();
        }
        commit.metadataHash = metadataHash;
        commit.imagePathHash = imagePathHash;
        commit.metadataCommitted = true;
        emit MintMetadataCommitted(msg.sender, metadataHash, imagePathHash);
    }

    /// @notice Current mint price for this deployment.
    /// @dev Linear pricing uses base + step * totalMinted. LESS pricing scales 1x→4x as supply drops.
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
        uint256 factorWad = WAD + (delta * 3 * WAD) / ONE_BILLION;
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

    /// @notice Compute the commitment hash for a mint.
    /// @param minter Address committing.
    /// @param salt User-provided salt.
    /// @param refsHash Canonical refs hash.
    /// @return commitment Commitment hash.
    function computeCommitment(
        address minter,
        bytes32 salt,
        bytes32 refsHash
    ) external pure returns (bytes32) {
        return _computeCommitment(minter, salt, refsHash);
    }

    /// @notice Preview palette index for a minter's active commit.
    /// @param minter Address with an active commit.
    /// @return paletteIndex Expected palette index if minted now.
    function previewPaletteIndex(address minter) external view returns (uint256) {
        MintCommit memory commit = mintCommitByMinter[minter];
        _requireValidCommit(commit);
        if (!commit.randomnessReady) {
            revert MintRandomnessPending();
        }
        if (!commit.paletteAssigned) {
            revert MintCapReached();
        }
        return commit.paletteIndex;
    }

    /// @notice Metadata URI derived from palette index.
    /// @param tokenId Token id to query.
    /// @return uri Token metadata URI.
    function tokenURI(uint256 tokenId) public view override(ERC721) returns (string memory) {
        _requireOwned(tokenId);
        string memory uri = _tokenUriByTokenId[tokenId];
        if (bytes(uri).length == 0) {
            revert TokenUriRequired();
        }
        return uri;
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

    /// @notice ERC-165 support for ERC721 + ERC2981.
    /// @param interfaceId Interface id to query.
    /// @return True if interface supported.
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC2981) returns (bool) {
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

    function _computeCommitment(
        address minter,
        bytes32 salt,
        bytes32 refsHash
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(COMMIT_DOMAIN, minter, salt, refsHash));
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

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        if (randomWords.length == 0) {
            return;
        }
        MintRequest memory request = _mintRequestById[requestId];
        if (request.minter == address(0)) {
            return;
        }
        MintCommit storage commit = mintCommitByMinter[request.minter];
        if (commit.commitment != request.commitment || commit.requestId != requestId) {
            return;
        }
        commit.randomness = randomWords[0];
        commit.randomnessReady = true;
        if (totalAssigned < MAX_MINTS) {
            uint256 paletteIndex = _assignPaletteIndex(randomWords[0]);
            commit.paletteIndex = paletteIndex;
            commit.paletteAssigned = true;
            ++totalAssigned;
        }
        delete _mintRequestById[requestId];
        emit MintRandomnessFulfilled(request.minter, requestId, randomWords[0]);
    }

    function _consumeCommit(
        bytes32 salt,
        bytes32 refsHash,
        bytes32 metadataHash,
        bytes32 imagePathHash
    ) private returns (uint256 paletteIndex) {
        MintCommit memory commit = mintCommitByMinter[msg.sender];
        _requireValidCommit(commit);
        if (!commit.randomnessReady) {
            revert MintRandomnessPending();
        }
        if (!commit.paletteAssigned) {
            revert MintCapReached();
        }
        if (!commit.metadataCommitted) {
            revert MintMetadataCommitRequired();
        }
        if (commit.metadataHash != metadataHash || commit.imagePathHash != imagePathHash) {
            revert MintMetadataMismatch();
        }
        if (_computeCommitment(msg.sender, salt, refsHash) != commit.commitment) {
            revert MintCommitMismatch();
        }
        paletteIndex = commit.paletteIndex;
        delete mintCommitByMinter[msg.sender];
    }

    function _requireValidCommit(MintCommit memory commit) private view {
        if (commit.blockNumber == 0) {
            revert MintCommitRequired();
        }
        uint256 earliestBlock = commit.blockNumber + COMMIT_REVEAL_DELAY_BLOCKS;
        if (block.number < earliestBlock) {
            revert MintCommitPendingBlock();
        }
        uint256 expiryBlock = commit.blockNumber + COMMIT_REVEAL_DELAY_BLOCKS + COMMIT_REVEAL_WINDOW_BLOCKS;
        if (block.number > expiryBlock) {
            revert MintCommitExpired();
        }
    }

    function _isCommitActive(uint256 blockNumber) private view returns (bool) {
        uint256 expiryBlock = blockNumber + COMMIT_REVEAL_DELAY_BLOCKS + COMMIT_REVEAL_WINDOW_BLOCKS;
        return block.number <= expiryBlock;
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

    function _resolvePaletteIndex(uint256 offset) private view returns (uint256) {
        uint256 mapped = _paletteIndexSwap[offset];
        return mapped == 0 ? offset : mapped - 1;
    }

    function _drawPaletteIndex(uint256 randomness) private returns (uint256) {
        uint256 remaining = MAX_MINTS - totalAssigned;
        if (remaining == 0) {
            revert MintCapReached();
        }
        uint256 rand = randomness % remaining;
        uint256 selected = _resolvePaletteIndex(rand);

        uint256 lastIndex = remaining - 1;
        if (rand != lastIndex) {
            uint256 lastValue = _resolvePaletteIndex(lastIndex);
            _paletteIndexSwap[rand] = lastValue + 1;
        }

        return selected;
    }

    function _assignPaletteIndex(uint256 randomness) private returns (uint256) {
        return _drawPaletteIndex(randomness);
    }

    function _previewPaletteIndex(uint256 randomness) private view returns (uint256) {
        uint256 remaining = MAX_MINTS - totalAssigned;
        if (remaining == 0) {
            revert MintCapReached();
        }
        uint256 rand = randomness % remaining;
        return _resolvePaletteIndex(rand);
    }
}
