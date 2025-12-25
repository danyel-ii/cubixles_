// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IceCubeMinter } from "../src/icecube/IceCubeMinter.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

contract MockERC721 is ERC721 {
    uint256 private _nextId = 1;

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextId;
        _nextId += 1;
        _safeMint(to, tokenId);
    }
}

contract IceCubeMinterTest is Test {
    IceCubeMinter private minter;
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
        minter = new IceCubeMinter(resaleSplitter, address(lessToken), 500);
        vm.stopPrank();

        nftA = new MockERC721("NFT A", "NFTA");
        nftB = new MockERC721("NFT B", "NFTB");
        nftC = new MockERC721("NFT C", "NFTC");
    }

    function _buildRefs(
        uint256 tokenA,
        uint256 tokenB,
        uint256 tokenC
    ) internal view returns (IceCubeMinter.NftRef[] memory refs) {
        refs = new IceCubeMinter.NftRef[](3);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nftA), tokenId: tokenA });
        refs[1] = IceCubeMinter.NftRef({ contractAddress: address(nftB), tokenId: tokenB });
        refs[2] = IceCubeMinter.NftRef({ contractAddress: address(nftC), tokenId: tokenC });
    }

    function _previewTokenId(
        address minterAddr,
        bytes32 salt,
        IceCubeMinter.NftRef[] memory refs
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

    function testMintRequiresOwnership() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(address(0xBEEF));

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        vm.prank(minterAddr);
        vm.expectRevert("Not owner of referenced NFT");
        minter.mint(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintPaysOwner() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 amount = minter.currentMintPrice();
        vm.deal(minterAddr, amount);

        vm.prank(minterAddr);
        minter.mint{ value: amount }(DEFAULT_SALT, "ipfs://token", refs);

        assertEq(owner.balance, amount);
    }

    function testMintSetsTokenUri() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
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

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        IceCubeMinter.NftRef[] memory shuffled = new IceCubeMinter.NftRef[](3);
        shuffled[0] = refs[2];
        shuffled[1] = refs[0];
        shuffled[2] = refs[1];

        uint256 idA = _previewTokenId(minterAddr, DEFAULT_SALT, refs);
        uint256 idB = _previewTokenId(minterAddr, DEFAULT_SALT, shuffled);

        assertEq(idA, idB);
    }

    function testMintTracksEnumeration() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

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
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](0);

        vm.expectRevert("Invalid reference count");
        minter.mint(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintRejectsTooManyRefs() public {
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](7);

        vm.expectRevert("Invalid reference count");
        minter.mint(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintRejectsInsufficientPayment() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price - 1);
        vm.prank(minterAddr);
        vm.expectRevert("INSUFFICIENT_ETH");
        minter.mint{ value: price - 1 }(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintRefundsExcessPayment() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](3);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nftA), tokenId: tokenA });
        refs[1] = IceCubeMinter.NftRef({ contractAddress: address(nftB), tokenId: tokenB });
        refs[2] = IceCubeMinter.NftRef({ contractAddress: address(nftC), tokenId: tokenC });

        uint256 required = minter.currentMintPrice();
        uint256 amount = required + 0.001 ether;
        vm.deal(minterAddr, amount);

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

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

        vm.prank(minterAddr);
        uint256 tokenId = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

        assertEq(minter.mintSupplySnapshot(tokenId), supply);
        assertEq(minter.lastSupplySnapshot(tokenId), supply);
    }

    function testLastSnapshotUpdatesOnTransfer() public {
        uint256 supply = 50_000e18;
        lessToken.mint(address(this), supply);

        address minterAddr = makeAddr("minter");
        address receiver = makeAddr("receiver");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

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

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

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

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);

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

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 preview = _previewTokenId(minterAddr, DEFAULT_SALT, refs);

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        uint256 minted = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

        assertEq(minted, preview);
    }

    function testReplayReverts() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[] memory refs = _buildRefs(tokenA, tokenB, tokenC);
        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price * 2);

        vm.prank(minterAddr);
        minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);

        vm.prank(minterAddr);
        vm.expectRevert("TOKENID_EXISTS");
        minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testTokenIdCanonicalOrderIgnoresInputOrder() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[] memory refsA = _buildRefs(tokenA, tokenB, tokenC);
        IceCubeMinter.NftRef[] memory refsB = new IceCubeMinter.NftRef[](3);
        refsB[0] = IceCubeMinter.NftRef({ contractAddress: address(nftB), tokenId: tokenB });
        refsB[1] = IceCubeMinter.NftRef({ contractAddress: address(nftA), tokenId: tokenA });
        refsB[2] = IceCubeMinter.NftRef({ contractAddress: address(nftC), tokenId: tokenC });

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
}
