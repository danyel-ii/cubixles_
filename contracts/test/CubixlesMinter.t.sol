// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { StdStorage, stdStorage } from "forge-std/StdStorage.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { CubixlesMinter } from "../src/cubixles/CubixlesMinter.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockVRFCoordinatorV2 } from "./mocks/MockVRFCoordinatorV2.sol";
import { Refs } from "./helpers/Refs.sol";

contract MockERC721 is ERC721 {
    uint256 private _nextId = 1;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextId;
        _nextId += 1;
        _safeMint(to, tokenId);
    }
}

contract CubixlesMinterHarness is CubixlesMinter {
    constructor(
        address splitter,
        address lessToken,
        uint96 bps,
        string memory paletteImagesCID,
        bytes32 paletteManifestHash,
        address vrfCoordinator,
        bytes32 vrfKeyHash,
        uint64 vrfSubscriptionId,
        uint16 vrfRequestConfirmations,
        uint32 vrfCallbackGasLimit
    )
        CubixlesMinter(
            splitter,
            lessToken,
            bps,
            0,
            0,
            0,
            false,
            paletteImagesCID,
            paletteManifestHash,
            address(vrfCoordinator),
            vrfKeyHash,
            vrfSubscriptionId,
            vrfRequestConfirmations,
            vrfCallbackGasLimit
        )
    {}

    function exposedRoundUp(uint256 value, uint256 step) external pure returns (uint256) {
        return _roundUp(value, step);
    }
}

contract CubixlesMinterTest is Test {
    using stdStorage for StdStorage;

    CubixlesMinter private minter;
    MockERC721 private nftA;
    MockERC721 private nftB;
    MockERC721 private nftC;
    MockERC20 private lessToken;

    address private owner = makeAddr("owner");
    address private resaleSplitter = makeAddr("splitter");
    MockVRFCoordinatorV2 private vrfCoordinator;
    uint256 private constant ONE_BILLION = 1_000_000_000e18;
    uint256 private constant BASE_PRICE = 2_200_000_000_000_000;
    uint256 private constant PRICE_STEP = 100_000_000_000_000;
    bytes32 private constant DEFAULT_SALT = keccak256("salt");
    bytes32 private constant VRF_KEY_HASH = keccak256("vrf-key");
    uint64 private constant VRF_SUB_ID = 1;
    uint16 private constant VRF_CONFIRMATIONS = 3;
    uint32 private constant VRF_CALLBACK_GAS_LIMIT = 200_000;
    uint256 private constant DEFAULT_RANDOMNESS = 123_456;
    string private constant PALETTE_IMAGES_CID = "bafyimagescid";
    bytes32 private constant PALETTE_MANIFEST_HASH = keccak256("manifest");
    string private constant TOKEN_URI_PREFIX = "ipfs://metadata/";
    bytes32 private constant METADATA_HASH = keccak256("metadata");
    bytes32 private constant IMAGE_PATH_HASH = keccak256("image-path");

    function setUp() public {
        vm.startPrank(owner);
        lessToken = new MockERC20("LESS", "LESS");
        vrfCoordinator = new MockVRFCoordinatorV2();
        minter = new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            500,
            0,
            0,
            0,
            false,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
        vm.stopPrank();

        nftA = new MockERC721("NFT A", "NFTA");
        nftB = new MockERC721("NFT B", "NFTB");
        nftC = new MockERC721("NFT C", "NFTC");
    }

    function _buildRefs(
        uint256 tokenA,
        uint256 tokenB,
        uint256 tokenC
    ) internal view returns (CubixlesMinter.NftRef[] memory refs) {
        refs = new CubixlesMinter.NftRef[](3);
        refs[0] = CubixlesMinter.NftRef({ contractAddress: address(nftA), tokenId: tokenA });
        refs[1] = CubixlesMinter.NftRef({ contractAddress: address(nftB), tokenId: tokenB });
        refs[2] = CubixlesMinter.NftRef({ contractAddress: address(nftC), tokenId: tokenC });
    }

    function _previewTokenId(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs
    ) internal returns (uint256) {
        vm.prank(minterAddr);
        return minter.previewTokenId(salt, refs);
    }

    function _roundUp(uint256 value, uint256 step) internal pure returns (uint256) {
        if (value == 0) {
            return 0;
        }
        return ((value + step - 1) / step) * step;
    }

    function _buildTokenURI(uint256 paletteIndex) internal view returns (string memory) {
        return string.concat(TOKEN_URI_PREFIX, vm.toString(paletteIndex));
    }

    function _commitMetadata(address minterAddr) internal {
        vm.prank(minterAddr);
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH);
    }

    function _mintWithExpected(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs,
        uint256 value
    ) internal returns (uint256 tokenId) {
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        string memory tokenUri = _buildTokenURI(expected);
        vm.prank(minterAddr);
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH);
        vm.prank(minterAddr);
        tokenId = minter.mint{ value: value }(
            salt,
            refs,
            expected,
            tokenUri,
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function _commitMint(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs
    ) internal returns (uint256 requestId) {
        bytes32 refsHash = Refs.hashCanonical(refs);
        bytes32 commitment = minter.computeCommitment(minterAddr, salt, refsHash);
        uint256 commitFee = minter.commitFeeWei();
        vm.prank(minterAddr);
        minter.commitMint{ value: commitFee }(commitment);
        vm.roll(block.number + 1);
        (, , requestId, , , , , , , , ) = minter.mintCommitByMinter(minterAddr);
    }

    function _commitMintSameBlock(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs
    ) internal {
        bytes32 refsHash = Refs.hashCanonical(refs);
        bytes32 commitment = minter.computeCommitment(minterAddr, salt, refsHash);
        uint256 commitFee = minter.commitFeeWei();
        vm.prank(minterAddr);
        minter.commitMint{ value: commitFee }(commitment);
    }

    function _fulfillRandomness(uint256 requestId, uint256 randomness) internal {
        uint256[] memory words = new uint256[](1);
        words[0] = randomness;
        vm.prank(address(vrfCoordinator));
        minter.rawFulfillRandomWords(requestId, words);
    }

    function _commitAndFulfill(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs,
        uint256 randomness
    ) internal {
        uint256 requestId = _commitMint(minterAddr, salt, refs);
        _fulfillRandomness(requestId, randomness);
    }

    function _deployWithConfig(
        string memory paletteImagesCid,
        bytes32 paletteManifestHash,
        address vrfCoordinatorAddr,
        bytes32 vrfKeyHash,
        uint64 vrfSubscriptionId,
        uint16 vrfRequestConfirmations,
        uint32 vrfCallbackGasLimit
    ) internal returns (CubixlesMinter) {
        return new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            500,
            0,
            0,
            0,
            false,
            paletteImagesCid,
            paletteManifestHash,
            vrfCoordinatorAddr,
            vrfKeyHash,
            vrfSubscriptionId,
            vrfRequestConfirmations,
            vrfCallbackGasLimit
        );
    }

    function testMintRequiresOwnership() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(address(0xBEEF));

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        _commitMetadata(minterAddr);
        vm.prank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesMinter.RefNotOwned.selector,
                address(nftC),
                tokenC,
                minterAddr,
                address(0xBEEF)
            )
        );
        minter.mint(
            DEFAULT_SALT,
            refs,
            expected,
            _buildTokenURI(expected),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testMintPaysSplitter() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        _mintWithExpected(minterAddr, DEFAULT_SALT, refs, amount);

        assertEq(resaleSplitter.balance, amount);
    }

    function testMintRequiresCommit() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitRequired.selector);
        minter.mint{ value: amount }(
            DEFAULT_SALT,
            refs,
            0,
            _buildTokenURI(0),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testMintCapReached() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        stdstore
            .target(address(minter))
            .sig("totalMinted()")
            .checked_write(minter.MAX_MINTS());

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCapReached.selector);
        minter.mint{ value: amount }(
            DEFAULT_SALT,
            refs,
            0,
            _buildTokenURI(0),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testMintCapIsTenThousand() public {
        assertEq(minter.MAX_MINTS(), 10_000);
        assertEq(minter.MAX_MINTS(), minter.PALETTE_SIZE());
    }

    function testPaletteIndexUniqueForMultipleMints() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount * 5);

        uint256[] memory indices = new uint256[](5);
        for (uint256 i = 0; i < indices.length; i += 1) {
            bytes32 salt = keccak256(abi.encodePacked("salt", i));
            _commitAndFulfill(minterAddr, salt, refs, DEFAULT_RANDOMNESS + i);

            uint256 tokenId = _mintWithExpected(minterAddr, salt, refs, amount);
            uint256 paletteIndex = minter.paletteIndexByTokenId(tokenId);
            indices[i] = paletteIndex;
        }

        for (uint256 i = 0; i < indices.length; i += 1) {
            assertLt(indices[i], minter.PALETTE_SIZE());
            for (uint256 j = i + 1; j < indices.length; j += 1) {
                assertTrue(indices[i] != indices[j]);
            }
        }
    }

    function testMintSetsTokenUri() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 expectedIndex = minter.previewPaletteIndex(minterAddr);
        string memory expectedTokenUri = _buildTokenURI(expectedIndex);
        _commitMetadata(minterAddr);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mint{ value: price }(
            DEFAULT_SALT,
            refs,
            expectedIndex,
            expectedTokenUri,
            METADATA_HASH,
            IMAGE_PATH_HASH
        );

        assertEq(minter.ownerOf(tokenId), minterAddr);
        assertEq(minter.tokenURI(tokenId), expectedTokenUri);
    }

    function testMintRecordsMintPrice() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 tokenId = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);

        assertEq(minter.mintPriceByTokenId(tokenId), price);
    }

    function testPreviewTokenIdCanonicalizesRefs() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        CubixlesMinter.NftRef[] memory shuffled = new CubixlesMinter.NftRef[](3);
        shuffled[0] = refs[2];
        shuffled[1] = refs[0];
        shuffled[2] = refs[1];

        uint256 idA = _previewTokenId(minterAddr, DEFAULT_SALT, refs);
        uint256 idB = _previewTokenId(minterAddr, DEFAULT_SALT, shuffled);

        assertEq(idA, idB);
    }

    function testTokenIdDiffersAcrossAccountsAndSalts() public {
        address minterA = makeAddr("minterA");
        address minterB = makeAddr("minterB");
        uint256 tokenA = nftA.mint(minterA);
        uint256 tokenB = nftB.mint(minterA);
        uint256 tokenC = nftC.mint(minterA);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        bytes32 saltA = keccak256("salt-a");
        bytes32 saltB = keccak256("salt-b");

        uint256 price = minter.currentMintPrice();
        vm.deal(minterA, price);
        _commitAndFulfill(minterA, saltA, refs, DEFAULT_RANDOMNESS);
        uint256 tokenIdA = _mintWithExpected(minterA, saltA, refs, price);

        vm.prank(minterA);
        nftA.transferFrom(minterA, minterB, tokenA);
        vm.prank(minterA);
        nftB.transferFrom(minterA, minterB, tokenB);
        vm.prank(minterA);
        nftC.transferFrom(minterA, minterB, tokenC);

        vm.deal(minterB, price);
        _commitAndFulfill(minterB, saltB, refs, DEFAULT_RANDOMNESS + 1);
        uint256 tokenIdB = _mintWithExpected(minterB, saltB, refs, price);

        assertTrue(tokenIdA != tokenIdB);
    }

    function testMintTracksEnumeration() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 tokenId = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);

        assertEq(minter.totalMinted(), 1);
        assertEq(minter.tokenIdByIndex(1), tokenId);
        assertEq(minter.minterByTokenId(tokenId), minterAddr);
    }

    function testRoyaltyInfoDefaults() public {
        (address receiver, uint256 amount) = minter.royaltyInfo(1, 1 ether);
        assertEq(receiver, resaleSplitter);
        assertEq(amount, 0.05 ether);
    }

    function testMintRejectsEmptyRefs() public {
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](0);
        address minterAddr = makeAddr("minter");

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.InvalidReferenceCount.selector);
        minter.mint(
            DEFAULT_SALT,
            refs,
            0,
            _buildTokenURI(0),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testMintRejectsTooManyRefs() public {
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](7);
        address minterAddr = makeAddr("minter");

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.InvalidReferenceCount.selector);
        minter.mint(
            DEFAULT_SALT,
            refs,
            0,
            _buildTokenURI(0),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testMintRejectsInsufficientPayment() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price - 1);
        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.InsufficientEth.selector);
        minter.mint{ value: price - 1 }(
            DEFAULT_SALT,
            refs,
            0,
            _buildTokenURI(0),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testMintRefundsExcessPayment() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](3);
        refs[0] = CubixlesMinter.NftRef({ contractAddress: address(nftA), tokenId: tokenA });
        refs[1] = CubixlesMinter.NftRef({ contractAddress: address(nftB), tokenId: tokenB });
        refs[2] = CubixlesMinter.NftRef({ contractAddress: address(nftC), tokenId: tokenC });

        uint256 required = minter.currentMintPrice();
        uint256 amount = required + 0.001 ether;
        vm.deal(minterAddr, amount);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        _mintWithExpected(minterAddr, DEFAULT_SALT, refs, amount);

        assertEq(minterAddr.balance, amount - required);
    }

    function testMintSnapshotsSupply() public {
        uint256 supply = 123_000e18;
        lessToken.mint(address(this), supply);

        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 tokenId = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);

        assertEq(minter.mintSupplySnapshot(tokenId), supply);
        assertEq(minter.lastSupplySnapshot(tokenId), supply);
    }

    function testLessSupplyNowReturnsTotalSupply() public {
        uint256 supply = 555_000e18;
        lessToken.mint(address(this), supply);

        assertEq(minter.lessSupplyNow(), supply);
    }

    function testRoundUpZeroReturnsZero() public {
        CubixlesMinterHarness harness = new CubixlesMinterHarness(
            resaleSplitter,
            address(lessToken),
            500,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
        assertEq(harness.exposedRoundUp(0, 1e14), 0);
    }

    function testConstructorRevertsOnZeroResaleSplitter() public {
        vm.expectRevert(CubixlesMinter.ResaleSplitterRequired.selector);
        new CubixlesMinter(
            address(0),
            address(lessToken),
            500,
            0,
            0,
            0,
            false,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testConstructorRevertsOnZeroLessToken() public {
        vm.expectRevert(CubixlesMinter.FixedPriceRequired.selector);
        new CubixlesMinter(
            resaleSplitter,
            address(0),
            500,
            0,
            0,
            0,
            false,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testConstructorRevertsOnRoyaltyTooHigh() public {
        vm.expectRevert(CubixlesMinter.RoyaltyTooHigh.selector);
        new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            1001,
            0,
            0,
            0,
            false,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testConstructorRevertsOnEmptyPaletteImagesCid() public {
        vm.expectRevert(CubixlesMinter.PaletteImagesCidRequired.selector);
        _deployWithConfig(
            "",
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testConstructorRevertsOnZeroPaletteManifestHash() public {
        vm.expectRevert(CubixlesMinter.PaletteManifestHashRequired.selector);
        _deployWithConfig(
            PALETTE_IMAGES_CID,
            bytes32(0),
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testConstructorRevertsOnZeroVrfCoordinator() public {
        vm.expectRevert(CubixlesMinter.VrfCoordinatorRequired.selector);
        _deployWithConfig(
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(0),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testConstructorRevertsOnZeroVrfKeyHash() public {
        vm.expectRevert(CubixlesMinter.VrfKeyHashRequired.selector);
        _deployWithConfig(
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            bytes32(0),
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testConstructorRevertsOnZeroVrfSubscriptionId() public {
        vm.expectRevert(CubixlesMinter.VrfSubscriptionRequired.selector);
        _deployWithConfig(
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            0,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testConstructorRevertsOnZeroVrfRequestConfirmations() public {
        vm.expectRevert(CubixlesMinter.VrfRequestConfirmationsRequired.selector);
        _deployWithConfig(
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            0,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testConstructorRevertsOnZeroVrfCallbackGasLimit() public {
        vm.expectRevert(CubixlesMinter.VrfCallbackGasLimitRequired.selector);
        _deployWithConfig(
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            0
        );
    }

    function testFixedPriceWhenLessDisabled() public {
        uint256 fixedPrice = 2_000_000_000_000_000;
        CubixlesMinter fixedMinter = new CubixlesMinter(
            resaleSplitter,
            address(0),
            500,
            fixedPrice,
            0,
            0,
            false,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
        assertEq(fixedMinter.currentMintPrice(), fixedPrice);
        assertEq(fixedMinter.lessSupplyNow(), 0);
    }

    function testLinearPricingRequiresConfig() public {
        vm.expectRevert(CubixlesMinter.LinearPricingConfigRequired.selector);
        new CubixlesMinter(
            resaleSplitter,
            address(0),
            500,
            0,
            0,
            0,
            true,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testLinearPricingNotAllowedWithLess() public {
        vm.expectRevert(CubixlesMinter.LinearPricingNotAllowed.selector);
        new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            500,
            0,
            1,
            1,
            true,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
    }

    function testLinearPricingUsesBaseAndStep() public {
        uint256 basePrice = 1_200_000_000_000_000;
        uint256 step = 12_000_000_000_000;
        CubixlesMinter linearMinter = new CubixlesMinter(
            resaleSplitter,
            address(0),
            500,
            0,
            basePrice,
            step,
            true,
            PALETTE_IMAGES_CID,
            PALETTE_MANIFEST_HASH,
            address(vrfCoordinator),
            VRF_KEY_HASH,
            VRF_SUB_ID,
            VRF_CONFIRMATIONS,
            VRF_CALLBACK_GAS_LIMIT
        );
        assertEq(linearMinter.currentMintPrice(), basePrice);
        stdstore
            .target(address(linearMinter))
            .sig("totalMinted()")
            .checked_write(2);
        assertEq(linearMinter.currentMintPrice(), basePrice + (step * 2));
    }

    function testLastSnapshotUpdatesOnTransfer() public {
        uint256 supply = 50_000e18;
        lessToken.mint(address(this), supply);

        address minterAddr = makeAddr("minter");
        address receiver = makeAddr("receiver");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 tokenId = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);

        uint256 nextSupply = supply + 25_000e18;
        lessToken.mint(address(this), nextSupply - supply);

        vm.prank(minterAddr);
        minter.transferFrom(minterAddr, receiver, tokenId);

        assertEq(minter.mintSupplySnapshot(tokenId), supply);
        assertEq(minter.lastSupplySnapshot(tokenId), nextSupply);
    }

    function testDeltaClampsWhenSupplyIncreases() public {
        uint256 supply = 10_000e18;
        lessToken.mint(address(this), supply);

        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 tokenId = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);

        lessToken.mint(address(this), 5_000e18);

        assertEq(minter.deltaFromMint(tokenId), 0);
        assertEq(minter.deltaFromLast(tokenId), 0);
    }

    function testDeltaPositiveWhenSupplyDecreases() public {
        uint256 supply = 20_000e18;
        lessToken.mint(address(this), supply);

        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 tokenId = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);

        lessToken.burn(address(this), 6_000e18);

        assertEq(minter.deltaFromMint(tokenId), 6_000e18);
        assertEq(minter.deltaFromLast(tokenId), 6_000e18);
    }

    function testPreviewTokenIdMatchesMint() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 preview = _previewTokenId(minterAddr, DEFAULT_SALT, refs);

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 minted = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);

        assertEq(minted, preview);
    }

    function testReplayReverts() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price * 2);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS + 1);
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        _commitMetadata(minterAddr);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.TokenIdExists.selector);
        minter.mint{ value: price }(
            DEFAULT_SALT,
            refs,
            expected,
            _buildTokenURI(expected),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testTokenIdCanonicalOrderIgnoresInputOrder() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refsA = _buildRefs(tokenA, tokenB, tokenC);
        CubixlesMinter.NftRef[] memory refsB = new CubixlesMinter.NftRef[](3);
        refsB[0] = CubixlesMinter.NftRef({ contractAddress: address(nftB), tokenId: tokenB });
        refsB[1] = CubixlesMinter.NftRef({ contractAddress: address(nftA), tokenId: tokenA });
        refsB[2] = CubixlesMinter.NftRef({ contractAddress: address(nftC), tokenId: tokenC });

        uint256 previewA = _previewTokenId(minterAddr, DEFAULT_SALT, refsA);
        uint256 previewB = _previewTokenId(minterAddr, DEFAULT_SALT, refsB);

        assertEq(previewA, previewB);
    }

    function testCurrentMintPriceSupplyZero() public {
        uint256 price = minter.currentMintPrice();
        assertEq(price, _roundUp(BASE_PRICE * 4, PRICE_STEP));
    }

    function testCurrentMintPriceHalfSupply() public {
        lessToken.mint(address(this), ONE_BILLION / 2);
        uint256 price = minter.currentMintPrice();
        assertEq(price, _roundUp((BASE_PRICE * 5) / 2, PRICE_STEP));
    }

    function testCurrentMintPriceFullSupply() public {
        lessToken.mint(address(this), ONE_BILLION);
        uint256 price = minter.currentMintPrice();
        assertEq(price, _roundUp(BASE_PRICE, PRICE_STEP));
    }

    function testCurrentMintPriceClamp() public {
        lessToken.mint(address(this), ONE_BILLION + 1);
        uint256 price = minter.currentMintPrice();
        assertEq(price, _roundUp(BASE_PRICE, PRICE_STEP));
    }

    function testCommitExpiryReverts() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        uint256 expiryDelta = minter.COMMIT_REVEAL_DELAY_BLOCKS() +
            minter.COMMIT_REVEAL_WINDOW_BLOCKS() +
            1;
        vm.roll(block.number + expiryDelta);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitExpired.selector);
        minter.mint{ value: amount }(
            DEFAULT_SALT,
            refs,
            0,
            _buildTokenURI(0),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testCommitMismatchReverts() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        CubixlesMinter.NftRef[] memory otherRefs = _buildRefs(tokenA, tokenB, tokenC);
        otherRefs[0].tokenId = nftA.mint(minterAddr);

        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, otherRefs, DEFAULT_RANDOMNESS);
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        _commitMetadata(minterAddr);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitMismatch.selector);
        minter.mint{ value: amount }(
            DEFAULT_SALT,
            refs,
            expected,
            _buildTokenURI(expected),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testCommitMintRevertsOnEmptyHash() public {
        vm.prank(makeAddr("minter"));
        vm.expectRevert(CubixlesMinter.MintCommitEmpty.selector);
        minter.commitMint(bytes32(0));
    }

    function testPreviewPaletteIndexRevertsWhenRandomnessPending() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintRandomnessPending.selector);
        minter.previewPaletteIndex(minterAddr);
    }

    function testPreviewPaletteIndexRevertsWhenPaletteNotAssigned() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 requestId = _commitMint(minterAddr, DEFAULT_SALT, refs);
        stdstore
            .target(address(minter))
            .sig("totalAssigned()")
            .checked_write(minter.MAX_MINTS());
        _fulfillRandomness(requestId, DEFAULT_RANDOMNESS);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCapReached.selector);
        minter.previewPaletteIndex(minterAddr);
    }

    function testSweepExpiredCommitRevertsWithoutCommit() public {
        address minterAddr = makeAddr("minter");
        vm.expectRevert(CubixlesMinter.MintCommitRequired.selector);
        minter.sweepExpiredCommit(minterAddr);
    }

    function testCommitFeeRequired() public {
        uint256 fee = 0.001 ether;
        vm.prank(owner);
        minter.setCommitFee(fee);

        address minterAddr = makeAddr("minter");
        bytes32 commitment = minter.computeCommitment(
            minterAddr,
            DEFAULT_SALT,
            keccak256("refs")
        );

        vm.prank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(CubixlesMinter.CommitFeeMismatch.selector, fee, 0)
        );
        minter.commitMint(commitment);

        vm.deal(minterAddr, fee);
        vm.prank(minterAddr);
        minter.commitMint{ value: fee }(commitment);
        assertEq(address(minter).balance, fee);
    }

    function testMintRevertsOnEmptyTokenUri() public {
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](0);
        vm.expectRevert(CubixlesMinter.TokenUriRequired.selector);
        minter.mint(
            DEFAULT_SALT,
            refs,
            0,
            "",
            keccak256("metadata"),
            keccak256("image-path")
        );
    }

    function testMintRevertsOnEmptyMetadataHash() public {
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](0);
        vm.expectRevert(CubixlesMinter.MetadataHashRequired.selector);
        minter.mint(
            DEFAULT_SALT,
            refs,
            0,
            "ipfs://metadata/1",
            bytes32(0),
            keccak256("image-path")
        );
    }

    function testMintRevertsOnEmptyImagePathHash() public {
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](0);
        vm.expectRevert(CubixlesMinter.ImagePathHashRequired.selector);
        minter.mint(
            DEFAULT_SALT,
            refs,
            0,
            "ipfs://metadata/1",
            keccak256("metadata"),
            bytes32(0)
        );
    }

    function testCommitFeeCreditedAtMint() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        uint256 fee = price / 2;
        vm.prank(owner);
        minter.setCommitFee(fee);
        vm.deal(minterAddr, price);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 mintValue = price - fee;
        uint256 splitterBefore = resaleSplitter.balance;
        _mintWithExpected(minterAddr, DEFAULT_SALT, refs, mintValue);

        assertEq(resaleSplitter.balance - splitterBefore, price);
        assertEq(minterAddr.balance, 0);
        assertEq(address(minter).balance, 0);
    }

    function testExpiredCommitForfeitsFee() public {
        uint256 fee = 0.0005 ether;
        vm.prank(owner);
        minter.setCommitFee(fee);

        address minterAddr = makeAddr("minter");
        bytes32 commitment = minter.computeCommitment(
            minterAddr,
            DEFAULT_SALT,
            keccak256("refs")
        );
        vm.deal(minterAddr, fee);
        vm.prank(minterAddr);
        minter.commitMint{ value: fee }(commitment);

        uint256 expiryBlock =
            block.number + minter.COMMIT_REVEAL_DELAY_BLOCKS() + minter.COMMIT_REVEAL_WINDOW_BLOCKS() + 1;
        vm.roll(expiryBlock);

        uint256 splitterBefore = resaleSplitter.balance;
        minter.sweepExpiredCommit(minterAddr);
        assertEq(resaleSplitter.balance - splitterBefore, fee);
        (, uint256 blockNumber, , , , , , , , , ) = minter.mintCommitByMinter(minterAddr);
        assertEq(blockNumber, 0);
    }

    function testCommitMintRevertsWhenActive() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        bytes32 refsHash = Refs.hashCanonical(refs);
        bytes32 commitment = minter.computeCommitment(minterAddr, DEFAULT_SALT, refsHash);
        vm.prank(minterAddr);
        minter.commitMint(commitment);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitActive.selector);
        minter.commitMint(commitment);
    }

    function testMintRevertsWhenCommitPendingBlock() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        _commitMintSameBlock(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitPendingBlock.selector);
        minter.mint{ value: amount }(
            DEFAULT_SALT,
            refs,
            0,
            _buildTokenURI(0),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testMintRevertsOnSaltMismatch() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        _commitMetadata(minterAddr);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitMismatch.selector);
        minter.mint{ value: amount }(
            keccak256("salt-b"),
            refs,
            expected,
            _buildTokenURI(expected),
            METADATA_HASH,
            IMAGE_PATH_HASH
        );
    }

    function testSetRoyaltyReceiverUpdatesDefault() public {
        address newSplitter = makeAddr("newSplitter");

        vm.prank(owner);
        minter.setRoyaltyReceiver(newSplitter);

        (address receiver, uint256 amount) = minter.royaltyInfo(1, 1 ether);
        assertEq(receiver, newSplitter);
        assertEq(amount, 0.05 ether);
    }

    function testSetRoyaltyReceiverRevertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(CubixlesMinter.ResaleSplitterRequired.selector);
        minter.setRoyaltyReceiver(address(0));
    }

    function testSetResaleRoyaltyRevertsOnZeroReceiver() public {
        vm.prank(owner);
        vm.expectRevert(CubixlesMinter.RoyaltyReceiverRequired.selector);
        minter.setResaleRoyalty(500, address(0));
    }

    function testSetResaleRoyaltyRevertsOnHighBps() public {
        vm.prank(owner);
        vm.expectRevert(CubixlesMinter.RoyaltyTooHigh.selector);
        minter.setResaleRoyalty(1001, makeAddr("receiver"));
    }

    function testSetResaleRoyaltyUpdatesDefault() public {
        address receiver = makeAddr("receiver");
        vm.prank(owner);
        minter.setResaleRoyalty(750, receiver);

        (address updatedReceiver, uint256 amount) = minter.royaltyInfo(1, 1 ether);
        assertEq(updatedReceiver, receiver);
        assertEq(amount, 0.075 ether);
    }

    function testSupportsInterfaceIncludesRoyalty() public {
        assertTrue(minter.supportsInterface(type(IERC2981).interfaceId));
        assertTrue(minter.supportsInterface(type(IERC721).interfaceId));
    }

    function testPaletteIndexStored() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

        _commitAndFulfill(minterAddr, DEFAULT_SALT, refs, DEFAULT_RANDOMNESS);
        uint256 tokenId = _mintWithExpected(minterAddr, DEFAULT_SALT, refs, price);

        uint256 paletteIndex = minter.paletteIndexByTokenId(tokenId);
        assertLt(paletteIndex, minter.PALETTE_SIZE());
    }
}
