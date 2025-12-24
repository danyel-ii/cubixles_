// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IceCubeMinter } from "../../src/icecube/IceCubeMinter.sol";
import { MockERC721Standard } from "../mocks/MockERC721s.sol";

contract IceCubeMinterFuzzTest is Test {
    IceCubeMinter private minter;
    MockERC721Standard private nft;
    address private owner = makeAddr("owner");
    address private resaleSplitter = makeAddr("splitter");
    uint256 private constant MINT_PRICE = 0.0017 ether;

    function setUp() public {
        vm.prank(owner);
        minter = new IceCubeMinter(resaleSplitter, 500);
        nft = new MockERC721Standard("MockNFT", "MNFT");
    }

    function _buildRefs(address minterAddr, uint8 count) internal returns (IceCubeMinter.NftRef[] memory refs) {
        refs = new IceCubeMinter.NftRef[](count);
        for (uint256 i = 0; i < count; i += 1) {
            uint256 tokenId = nft.mint(minterAddr);
            refs[i] = IceCubeMinter.NftRef({
                contractAddress: address(nft),
                tokenId: tokenId
            });
        }
    }

    function testFuzz_PaymentBoundary(uint256 paymentRaw, uint8 countRaw) public {
        uint8 count = uint8(bound(countRaw, 1, 6));
        uint256 payment = bound(paymentRaw, 0, 1 ether);
        address minterAddr = makeAddr("minter");

        IceCubeMinter.NftRef[] memory refs = _buildRefs(minterAddr, count);
        vm.deal(minterAddr, payment);

        vm.prank(minterAddr);
        if (payment < MINT_PRICE) {
            vm.expectRevert("Insufficient mint payment");
            minter.mint{ value: payment }("ipfs://token", refs);
            return;
        }

        uint256 ownerBefore = owner.balance;
        uint256 minterBefore = minterAddr.balance;
        minter.mint{ value: payment }("ipfs://token", refs);

        assertEq(owner.balance, ownerBefore + MINT_PRICE);
        assertEq(minterAddr.balance, minterBefore - MINT_PRICE);
    }

    function testFuzz_OwnershipGate(uint8 countRaw, bool injectWrongOwner) public {
        uint8 count = uint8(bound(countRaw, 1, 6));
        address minterAddr = makeAddr("minter");
        address other = makeAddr("other");

        IceCubeMinter.NftRef[] memory refs = _buildRefs(minterAddr, count);
        if (injectWrongOwner) {
            refs[count - 1].tokenId = nft.mint(other);
        }

        vm.deal(minterAddr, MINT_PRICE);
        vm.prank(minterAddr);
        if (injectWrongOwner) {
            vm.expectRevert("Not owner of referenced NFT");
            minter.mint{ value: MINT_PRICE }("ipfs://token", refs);
        } else {
            minter.mint{ value: MINT_PRICE }("ipfs://token", refs);
        }
    }
}
