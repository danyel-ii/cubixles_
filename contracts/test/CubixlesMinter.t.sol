// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { StdStorage, stdStorage } from "forge-std/StdStorage.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { CubixlesMinter } from "../src/cubixles/CubixlesMinter.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
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
        bytes32 paletteManifestHash
    )
        CubixlesMinter(
            splitter,
            lessToken,
            bps,
            CubixlesMinter.PricingConfig({
                fixedMintPriceWei: 0,
                baseMintPriceWei: 0,
                baseMintPriceStepWei: 0,
                linearPricingEnabled: false
            }),
            CubixlesMinter.PaletteConfig({
                paletteImagesCID: paletteImagesCID,
                paletteManifestHash: paletteManifestHash
            })
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
    uint256 private constant ONE_BILLION = 1_000_000_000e18;
    uint256 private constant BASE_PRICE = 2_200_000_000_000_000;
    uint256 private constant PRICE_STEP = 100_000_000_000_000;
    bytes32 private constant DEFAULT_SALT = keccak256("salt");
    uint256 private constant DEFAULT_RANDOMNESS = 123_456;
    string private constant PALETTE_IMAGES_CID = "bafyimagescid";
    bytes32 private constant PALETTE_MANIFEST_HASH = keccak256("manifest");
    string private constant TOKEN_URI_PREFIX = "ipfs://metadata/";
    bytes32 private constant METADATA_HASH = keccak256("metadata");
    bytes32 private constant IMAGE_PATH_HASH = keccak256("image-path");

    function _pricingConfig(
        uint256 fixedPrice,
        uint256 basePrice,
        uint256 stepPrice,
        bool linearEnabled
    ) internal pure returns (CubixlesMinter.PricingConfig memory) {
        return CubixlesMinter.PricingConfig({
            fixedMintPriceWei: fixedPrice,
            baseMintPriceWei: basePrice,
            baseMintPriceStepWei: stepPrice,
            linearPricingEnabled: linearEnabled
        });
    }

    function _paletteConfig(
        string memory imagesCid,
        bytes32 manifestHash
    ) internal pure returns (CubixlesMinter.PaletteConfig memory) {
        return CubixlesMinter.PaletteConfig({
            paletteImagesCID: imagesCid,
            paletteManifestHash: manifestHash
        });
    }

    function setUp() public {
        vm.startPrank(owner);
        lessToken = new MockERC20("LESS", "LESS");
        minter = new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            500,
            _pricingConfig(0, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
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
        uint256 rounded = (value + step - 1) / step;
        return rounded * step;
    }

    function _buildTokenURI(uint256 paletteIndex) internal pure returns (string memory) {
        return string.concat(TOKEN_URI_PREFIX, vm.toString(paletteIndex));
    }

    function _commitMetadata(address minterAddr) internal {
        uint256 expected = minter.previewPaletteIndex(minterAddr);
        vm.prank(minterAddr);
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH, expected);
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
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH, expected);
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
    ) internal {
        bytes32 refsHash = Refs.hashCanonical(refs);
        bytes32 commitment = minter.computeCommitment(minterAddr, salt, refsHash);
        vm.prank(minterAddr);
        minter.commitMint(commitment);
    }

    function _commitMintSameBlock(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs
    ) internal {
        bytes32 refsHash = Refs.hashCanonical(refs);
        bytes32 commitment = minter.computeCommitment(minterAddr, salt, refsHash);
        vm.prank(minterAddr);
        minter.commitMint(commitment);
    }

    function _advanceToReveal(address minterAddr) internal {
        (, uint256 commitBlock, , , , , ) = minter.mintCommitByMinter(minterAddr);
        uint256 revealBlock = commitBlock + minter.COMMIT_REVEAL_DELAY_BLOCKS();
        vm.roll(revealBlock + 1);
    }

    function _advancePastExpiry(address minterAddr) internal {
        (, uint256 commitBlock, , , , , ) = minter.mintCommitByMinter(minterAddr);
        uint256 expiryBlock = commitBlock
            + minter.COMMIT_REVEAL_DELAY_BLOCKS()
            + minter.COMMIT_REVEAL_WINDOW_BLOCKS();
        vm.roll(expiryBlock + 1);
    }

    function _commitAndFulfill(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs,
        uint256
    ) internal {
        _commitMint(minterAddr, salt, refs);
        _advanceToReveal(minterAddr);
    }

    function _deployWithConfig(
        string memory paletteImagesCid,
        bytes32 paletteManifestHash
    ) internal returns (CubixlesMinter) {
        return new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            500,
            _pricingConfig(0, 0, 0, false),
            _paletteConfig(paletteImagesCid, paletteManifestHash)
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

    function testMintCapIsTenThousand() public view {
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

    function testRoyaltyInfoDefaults() public view {
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
            PALETTE_MANIFEST_HASH
        );
        assertEq(harness.exposedRoundUp(0, 1e14), 0);
    }

    function testConstructorRevertsOnZeroResaleSplitter() public {
        vm.expectRevert(CubixlesMinter.ResaleSplitterRequired.selector);
        new CubixlesMinter(
            address(0),
            address(lessToken),
            500,
            _pricingConfig(0, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );
    }

    function testConstructorRevertsOnZeroLessToken() public {
        vm.expectRevert(CubixlesMinter.FixedPriceRequired.selector);
        new CubixlesMinter(
            resaleSplitter,
            address(0),
            500,
            _pricingConfig(0, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );
    }

    function testConstructorRevertsOnRoyaltyTooHigh() public {
        vm.expectRevert(CubixlesMinter.RoyaltyTooHigh.selector);
        new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            1001,
            _pricingConfig(0, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );
    }

    function testConstructorRevertsOnEmptyPaletteImagesCid() public {
        vm.expectRevert(CubixlesMinter.PaletteImagesCidRequired.selector);
        _deployWithConfig("", PALETTE_MANIFEST_HASH);
    }

    function testConstructorRevertsOnZeroPaletteManifestHash() public {
        vm.expectRevert(CubixlesMinter.PaletteManifestHashRequired.selector);
        _deployWithConfig(PALETTE_IMAGES_CID, bytes32(0));
    }

    function testFixedPriceWhenLessDisabled() public {
        uint256 fixedPrice = 2_000_000_000_000_000;
        CubixlesMinter fixedMinter = new CubixlesMinter(
            resaleSplitter,
            address(0),
            500,
            _pricingConfig(fixedPrice, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
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
            _pricingConfig(0, 0, 0, true),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );
    }

    function testLinearPricingNotAllowedWithLess() public {
        vm.expectRevert(CubixlesMinter.LinearPricingNotAllowed.selector);
        new CubixlesMinter(
            resaleSplitter,
            address(lessToken),
            500,
            _pricingConfig(0, 1, 1, true),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );
    }

    function testLinearPricingUsesBaseAndStep() public {
        uint256 basePrice = 1_200_000_000_000_000;
        uint256 step = 12_000_000_000_000;
        CubixlesMinter linearMinter = new CubixlesMinter(
            resaleSplitter,
            address(0),
            500,
            _pricingConfig(0, basePrice, step, true),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
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

    function testCurrentMintPriceSupplyZero() public view {
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

    function testPreviewPaletteIndexRevertsWhenRevealPending() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitPendingBlock.selector);
        minter.previewPaletteIndex(minterAddr);
    }

    function testPreviewPaletteIndexRevertsWhenPaletteNotAssigned() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        _advanceToReveal(minterAddr);
        stdstore
            .target(address(minter))
            .sig("totalAssigned()")
            .checked_write(minter.MAX_MINTS());

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCapReached.selector);
        minter.previewPaletteIndex(minterAddr);
    }

    function testSweepExpiredCommitRevertsWithoutCommit() public {
        address minterAddr = makeAddr("minter");
        vm.expectRevert(CubixlesMinter.MintCommitRequired.selector);
        minter.sweepExpiredCommit(minterAddr);
    }

    function testCommitCancelTriggersCooldown() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        bytes32 refsHash = Refs.hashCanonical(refs);

        bytes32 commitmentA = minter.computeCommitment(
            minterAddr,
            DEFAULT_SALT,
            refsHash
        );
        vm.prank(minterAddr);
        minter.commitMint(commitmentA);
        vm.prank(minterAddr);
        minter.cancelCommit();
        assertEq(minter.commitCancelCount(minterAddr), 1);
        assertEq(minter.commitCooldownUntil(minterAddr), 0);

        bytes32 commitmentB = minter.computeCommitment(
            minterAddr,
            keccak256("salt-b"),
            refsHash
        );
        vm.prank(minterAddr);
        minter.commitMint(commitmentB);
        vm.prank(minterAddr);
        minter.cancelCommit();

        uint256 untilBlock = minter.commitCooldownUntil(minterAddr);
        assertGt(untilBlock, block.number);
        vm.prank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(CubixlesMinter.MintCommitCooldown.selector, untilBlock)
        );
        minter.commitMint(commitmentB);
    }

    function testCommitMetadataRevertsOnEmptyMetadataHash() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        _advanceToReveal(minterAddr);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MetadataHashRequired.selector);
        minter.commitMetadata(bytes32(0), IMAGE_PATH_HASH, 0);
    }

    function testCommitMetadataRevertsOnEmptyImagePathHash() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        _advanceToReveal(minterAddr);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.ImagePathHashRequired.selector);
        minter.commitMetadata(METADATA_HASH, bytes32(0), 0);
    }

    function testCommitMetadataRevertsWhenAlreadyCommitted() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        _advanceToReveal(minterAddr);

        uint256 expected = minter.previewPaletteIndex(minterAddr);
        vm.prank(minterAddr);
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH, expected);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintMetadataCommitActive.selector);
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH, expected);
    }

    function testCommitMetadataRevertsOnPaletteMismatch() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        _advanceToReveal(minterAddr);

        uint256 expected = minter.previewPaletteIndex(minterAddr);
        vm.prank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesMinter.PaletteIndexMismatch.selector,
                expected + 1,
                expected
            )
        );
        minter.commitMetadata(METADATA_HASH, IMAGE_PATH_HASH, expected + 1);
    }

    function testCancelCommitForfeitsExpiredCommit() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        _advancePastExpiry(minterAddr);

        vm.prank(minterAddr);
        minter.cancelCommit();

        (, uint256 blockNumber, , , , , ) = minter.mintCommitByMinter(minterAddr);
        assertEq(blockNumber, 0);
    }

    function testSweepExpiredCommitRevertsWhenActive() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);

        vm.expectRevert(CubixlesMinter.MintCommitActive.selector);
        minter.sweepExpiredCommit(minterAddr);
    }

    function testSweepExpiredCommitClearsState() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        _advancePastExpiry(minterAddr);

        minter.sweepExpiredCommit(minterAddr);

        (, uint256 blockNumber, , , , , ) = minter.mintCommitByMinter(minterAddr);
        assertEq(blockNumber, 0);
    }

    function testSetCommitConfigUpdatesValues() public {
        vm.startPrank(owner);
        minter.setCommitCooldownBlocks(12);
        minter.setCommitCancelThreshold(3);
        vm.stopPrank();

        assertEq(minter.commitCooldownBlocks(), 12);
        assertEq(minter.commitCancelThreshold(), 3);
    }

    function testSetFixedMintPriceRevertsWhenLessEnabled() public {
        vm.prank(owner);
        vm.expectRevert(CubixlesMinter.FixedPriceNotAllowed.selector);
        minter.setFixedMintPrice(1 ether);
    }

    function testSetFixedMintPriceUpdatesWhenAllowed() public {
        vm.startPrank(owner);
        CubixlesMinter fixedMinter = new CubixlesMinter(
            resaleSplitter,
            address(0),
            500,
            _pricingConfig(1 ether, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );
        fixedMinter.setFixedMintPrice(2 ether);
        vm.stopPrank();

        assertEq(fixedMinter.fixedMintPriceWei(), 2 ether);
    }

    function testSetFixedMintPriceRevertsOnZero() public {
        vm.startPrank(owner);
        CubixlesMinter fixedMinter = new CubixlesMinter(
            resaleSplitter,
            address(0),
            500,
            _pricingConfig(1 ether, 0, 0, false),
            _paletteConfig(PALETTE_IMAGES_CID, PALETTE_MANIFEST_HASH)
        );
        vm.expectRevert(CubixlesMinter.FixedPriceRequired.selector);
        fixedMinter.setFixedMintPrice(0);
        vm.stopPrank();
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

    function testExpiredCommitClearsState() public {
        address minterAddr = makeAddr("minter");
        bytes32 commitment = minter.computeCommitment(
            minterAddr,
            DEFAULT_SALT,
            keccak256("refs")
        );
        vm.prank(minterAddr);
        minter.commitMint(commitment);

        uint256 expiryBlock =
            block.number + minter.COMMIT_REVEAL_DELAY_BLOCKS() + minter.COMMIT_REVEAL_WINDOW_BLOCKS() + 1;
        vm.roll(expiryBlock);

        minter.sweepExpiredCommit(minterAddr);
        (, uint256 blockNumber, , , , , ) = minter.mintCommitByMinter(minterAddr);
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

    function testSupportsInterfaceIncludesRoyalty() public view {
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
