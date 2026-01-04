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
        uint96 bps
    ) CubixlesMinter(splitter, lessToken, bps, 0) {}

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
    uint256 private constant BASE_PRICE = 1_500_000_000_000_000;
    uint256 private constant PRICE_STEP = 100_000_000_000_000;
    bytes32 private constant DEFAULT_SALT = keccak256("salt");

    function setUp() public {
        vm.startPrank(owner);
        lessToken = new MockERC20("LESS", "LESS");
        minter = new CubixlesMinter(resaleSplitter, address(lessToken), 500, 0);
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

    function _commitMint(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs
    ) internal {
        bytes32 refsHash = Refs.hashCanonical(refs);
        vm.prank(minterAddr);
        minter.commitMint(salt, refsHash);
        vm.roll(block.number + 1);
    }

    function _commitMintSameBlock(
        address minterAddr,
        bytes32 salt,
        CubixlesMinter.NftRef[] memory refs
    ) internal {
        bytes32 refsHash = Refs.hashCanonical(refs);
        vm.prank(minterAddr);
        minter.commitMint(salt, refsHash);
    }

    function testMintRequiresOwnership() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(address(0xBEEF));

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        _commitMint(minterAddr, DEFAULT_SALT, refs);
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
        minter.mint(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintPaysSplitter() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        minter.mint{ value: amount }(DEFAULT_SALT, "ipfs://token", refs);

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
        minter.mint{ value: amount }(DEFAULT_SALT, "ipfs://token", refs);
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
        minter.mint{ value: amount }(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintSetsTokenUri() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

        assertEq(minter.ownerOf(tokenId), minterAddr);
        assertEq(minter.tokenURI(tokenId), "ipfs://token");
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
        _commitMint(minterA, saltA, refs);
        vm.prank(minterA);
        uint256 tokenIdA = minter.mint{ value: price }(saltA, "ipfs://a", refs);

        vm.prank(minterA);
        nftA.transferFrom(minterA, minterB, tokenA);
        vm.prank(minterA);
        nftB.transferFrom(minterA, minterB, tokenB);
        vm.prank(minterA);
        nftC.transferFrom(minterA, minterB, tokenC);

        vm.deal(minterB, price);
        _commitMint(minterB, saltB, refs);
        vm.prank(minterB);
        uint256 tokenIdB = minter.mint{ value: price }(saltB, "ipfs://b", refs);

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

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

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
        minter.mint(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintRejectsTooManyRefs() public {
        CubixlesMinter.NftRef[] memory refs = new CubixlesMinter.NftRef[](7);
        address minterAddr = makeAddr("minter");

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.InvalidReferenceCount.selector);
        minter.mint(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintRejectsInsufficientPayment() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price - 1);
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.InsufficientEth.selector);
        minter.mint{ value: price - 1 }(DEFAULT_SALT, "ipfs://token", refs);
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

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        minter.mint{ value: amount }(DEFAULT_SALT, "ipfs://token", refs);

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

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

        assertEq(minter.mintSupplySnapshot(tokenId), supply);
        assertEq(minter.lastSupplySnapshot(tokenId), supply);
    }

    function testLessSupplyNowReturnsTotalSupply() public {
        uint256 supply = 555_000e18;
        lessToken.mint(address(this), supply);

        assertEq(minter.lessSupplyNow(), supply);
    }

    function testRoundUpZeroReturnsZero() public {
        CubixlesMinterHarness harness = new CubixlesMinterHarness(resaleSplitter, address(lessToken), 500);
        assertEq(harness.exposedRoundUp(0, 1e14), 0);
    }

    function testConstructorRevertsOnZeroResaleSplitter() public {
        vm.expectRevert(CubixlesMinter.ResaleSplitterRequired.selector);
        new CubixlesMinter(address(0), address(lessToken), 500, 0);
    }

    function testConstructorRevertsOnZeroLessToken() public {
        vm.expectRevert(CubixlesMinter.FixedPriceRequired.selector);
        new CubixlesMinter(resaleSplitter, address(0), 500, 0);
    }

    function testConstructorRevertsOnRoyaltyTooHigh() public {
        vm.expectRevert(CubixlesMinter.RoyaltyTooHigh.selector);
        new CubixlesMinter(resaleSplitter, address(lessToken), 1001, 0);
    }

    function testFixedPriceWhenLessDisabled() public {
        uint256 fixedPrice = 2_000_000_000_000_000;
        CubixlesMinter fixedMinter = new CubixlesMinter(resaleSplitter, address(0), 500, fixedPrice);
        assertEq(fixedMinter.currentMintPrice(), fixedPrice);
        assertEq(fixedMinter.lessSupplyNow(), 0);
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

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

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

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

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

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

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
        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        uint256 minted = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

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

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.TokenIdExists.selector);
        minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);
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
        assertEq(price, _roundUp(BASE_PRICE * 2, PRICE_STEP));
    }

    function testCurrentMintPriceHalfSupply() public {
        lessToken.mint(address(this), ONE_BILLION / 2);
        uint256 price = minter.currentMintPrice();
        assertEq(price, _roundUp((BASE_PRICE * 15) / 10, PRICE_STEP));
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

        bytes32 refsHash = Refs.hashCanonical(refs);
        vm.prank(minterAddr);
        minter.commitMint(DEFAULT_SALT, refsHash);
        vm.roll(block.number + minter.COMMIT_EXPIRY_BLOCKS() + 1);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitExpired.selector);
        minter.mint{ value: amount }(DEFAULT_SALT, "ipfs://token", refs);
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

        _commitMint(minterAddr, DEFAULT_SALT, otherRefs);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitMismatch.selector);
        minter.mint{ value: amount }(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testCommitMintRevertsOnEmptyHash() public {
        vm.prank(makeAddr("minter"));
        vm.expectRevert(CubixlesMinter.MintCommitEmpty.selector);
        minter.commitMint(DEFAULT_SALT, bytes32(0));
    }

    function testCommitMintRevertsWhenActive() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        bytes32 refsHash = Refs.hashCanonical(refs);
        vm.prank(minterAddr);
        minter.commitMint(DEFAULT_SALT, refsHash);

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitActive.selector);
        minter.commitMint(DEFAULT_SALT, refsHash);
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
        minter.mint{ value: amount }(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintRevertsOnSaltMismatch() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        CubixlesMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        vm.expectRevert(CubixlesMinter.MintCommitSaltMismatch.selector);
        minter.mint{ value: amount }(keccak256("salt-b"), "ipfs://token", refs);
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

        _commitMint(minterAddr, DEFAULT_SALT, refs);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

        uint256 paletteIndex = minter.paletteIndexByTokenId(tokenId);
        assertLt(paletteIndex, minter.PALETTE_SIZE());
    }
}
