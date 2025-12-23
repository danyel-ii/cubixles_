// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IceCubeMinter } from "../src/IceCubeMinter.sol";

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

    address private owner = makeAddr("owner");
    address private creator = makeAddr("creator");
    address private lessTreasury = makeAddr("less");
    address private pnkstrTreasury = makeAddr("pnkstr");
    address private poolTreasury = makeAddr("pool");

    function setUp() public {
        vm.startPrank(owner);
        minter = new IceCubeMinter(
            creator,
            lessTreasury,
            pnkstrTreasury,
            poolTreasury,
            500
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
    ) internal view returns (IceCubeMinter.NftRef[3] memory refs) {
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nftA), tokenId: tokenA });
        refs[1] = IceCubeMinter.NftRef({ contractAddress: address(nftB), tokenId: tokenB });
        refs[2] = IceCubeMinter.NftRef({ contractAddress: address(nftC), tokenId: tokenC });
    }

    function testMintRequiresOwnership() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(address(0xBEEF));

        IceCubeMinter.NftRef[3] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        vm.prank(minterAddr);
        vm.expectRevert("Not owner of referenced NFT");
        minter.mint("ipfs://token", refs);
    }

    function testMintDistributesRoyalty() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[3] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        uint256 amount = 1 ether;
        vm.deal(minterAddr, amount);

        vm.prank(minterAddr);
        minter.mint{ value: amount }("ipfs://token", refs);

        assertEq(creator.balance, 0.2 ether);
        assertEq(lessTreasury.balance, 0.4 ether);
        assertEq(pnkstrTreasury.balance, 0.2 ether);
        assertEq(poolTreasury.balance, 0.2 ether);
    }

    function testMintSetsTokenUri() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        uint256 tokenC = nftC.mint(minterAddr);

        IceCubeMinter.NftRef[3] memory refs = _buildRefs(tokenA, tokenB, tokenC);

        vm.prank(minterAddr);
        uint256 tokenId = minter.mint("ipfs://token", refs);

        assertEq(minter.ownerOf(tokenId), minterAddr);
        assertEq(minter.tokenURI(tokenId), "ipfs://token");
    }

    function testRoyaltyInfoDefaults() public {
        (address receiver, uint256 amount) = minter.royaltyInfo(1, 1 ether);
        assertEq(receiver, poolTreasury);
        assertEq(amount, 0.05 ether);
    }
}
