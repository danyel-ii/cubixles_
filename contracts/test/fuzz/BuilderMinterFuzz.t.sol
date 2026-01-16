// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { CubixlesBuilderMinter } from "../../src/builders/CubixlesBuilderMinter.sol";
import { MockERC721Royalty } from "../mocks/MockERC721Royalty.sol";

contract BuilderMinterFuzzTest is Test {
    CubixlesBuilderMinter private minter;
    MockERC721Royalty[6] private nfts;
    uint256[6] private tokenIds;
    address[6] private receivers;

    address private owner = makeAddr("owner");
    address private minterAddr = makeAddr("minter");

    function setUp() public {
        vm.prank(owner);
        minter = new CubixlesBuilderMinter("Cubixles Builders", "BLDR", "ipfs://base/");

        for (uint256 i = 0; i < 6; i += 1) {
            address receiver = address(uint160(uint256(keccak256(abi.encodePacked("rcv", i)))));
            receivers[i] = receiver;
            MockERC721Royalty nft = new MockERC721Royalty(
                string.concat("NFT", vm.toString(i)),
                string.concat("N", vm.toString(i)),
                receiver,
                500
            );
            nfts[i] = nft;
            tokenIds[i] = nft.mint(minterAddr);
        }
    }

    function testFuzzBuilderMintDistribution(uint8 refCount) public {
        vm.assume(refCount >= 1 && refCount <= 6);
        uint256 price = minter.MINT_PRICE_WEI();
        uint256 share = (price * minter.BUILDER_BPS()) / minter.BPS();

        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](refCount);
        for (uint256 i = 0; i < refCount; i += 1) {
            refs[i] = CubixlesBuilderMinter.NftRef({
                contractAddress: address(nfts[i]),
                tokenId: tokenIds[i]
            });
        }

        uint256 ownerStart = owner.balance;
        uint256[] memory receiverStarts = new uint256[](refCount);
        for (uint256 i = 0; i < refCount; i += 1) {
            receiverStarts[i] = receivers[i].balance;
        }

        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mintBuilders{ value: price }(refs);

        for (uint256 i = 0; i < refCount; i += 1) {
            assertEq(receivers[i].balance - receiverStarts[i], share);
        }
        assertEq(owner.balance - ownerStart, price - share * refCount);
        assertEq(minter.ownerOf(tokenId), minterAddr);
    }
}
