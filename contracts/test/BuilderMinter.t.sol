// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { CubixlesBuilderMinter } from "../src/builders/CubixlesBuilderMinter.sol";
import { MockERC721Royalty } from "./mocks/MockERC721Royalty.sol";
import {
    MockERC721RoyaltyRevertsOwner,
    MockERC721RoyaltyRevertsRoyalty,
    MockERC721RoyaltyZeroReceiver
} from "./mocks/MockERC721Royalty.sol";
import { MockERC2981Only } from "./mocks/MockERC2981Only.sol";
import { MockERC721Standard } from "./mocks/MockERC721s.sol";
import { ReceiverRevertsOnReceive } from "./mocks/Receivers.sol";

contract BuilderMinterTest is Test {
    CubixlesBuilderMinter private minter;
    MockERC721Royalty private nftA;
    MockERC721Royalty private nftB;
    MockERC721RoyaltyRevertsOwner private nftOwnerRevert;
    MockERC721RoyaltyRevertsRoyalty private nftRoyaltyRevert;
    MockERC721RoyaltyZeroReceiver private nftRoyaltyZero;
    MockERC2981Only private nftRoyaltyOnly;
    MockERC721Standard private nftNoRoyalty;

    address private owner = makeAddr("owner");
    address private minterAddr = makeAddr("minter");
    address private receiverA = makeAddr("receiverA");
    address private receiverB = makeAddr("receiverB");
    address private receiverC = makeAddr("receiverC");

    function setUp() public {
        vm.prank(owner);
        minter = new CubixlesBuilderMinter("Cubixles Builders", "BLDR", "ipfs://base/");

        nftA = new MockERC721Royalty("NFT A", "NFTA", receiverA, 500);
        nftB = new MockERC721Royalty("NFT B", "NFTB", receiverB, 500);
        nftOwnerRevert = new MockERC721RoyaltyRevertsOwner("NFT O", "NFTO", receiverC, 500);
        nftRoyaltyRevert = new MockERC721RoyaltyRevertsRoyalty("NFT R", "NFTR");
        nftRoyaltyZero = new MockERC721RoyaltyZeroReceiver("NFT Z", "NFTZ");
        nftRoyaltyOnly = new MockERC2981Only(receiverC, 500);
        nftNoRoyalty = new MockERC721Standard("NFT C", "NFTC");
    }

    function _mintRefs() internal returns (CubixlesBuilderMinter.NftRef[] memory refs) {
        vm.startPrank(minterAddr);
        uint256 tokenA = nftA.mint(minterAddr);
        uint256 tokenB = nftB.mint(minterAddr);
        vm.stopPrank();

        refs = new CubixlesBuilderMinter.NftRef[](2);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftA),
            tokenId: tokenA
        });
        refs[1] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftB),
            tokenId: tokenB
        });
    }

    function testBuilderMintPaysRoyaltyReceivers() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256 price = minter.MINT_PRICE_WEI();
        uint256 share = (price * minter.BUILDER_BPS()) / minter.BPS();

        vm.deal(minterAddr, price);
        uint256 ownerStart = owner.balance;
        uint256 receiverAStart = receiverA.balance;
        uint256 receiverBStart = receiverB.balance;

        vm.prank(minterAddr);
        minter.mintBuilders{ value: price }(refs);

        assertEq(receiverA.balance - receiverAStart, share);
        assertEq(receiverB.balance - receiverBStart, share);
        assertEq(owner.balance - ownerStart, price - (share * refs.length));
        assertEq(minter.ownerOf(1), minterAddr);
    }

    function testBuilderMintFallbackToOwnerOnReceiverRevert() public {
        ReceiverRevertsOnReceive badReceiver = new ReceiverRevertsOnReceive();
        nftA.setRoyalty(address(badReceiver), 500);
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256 price = minter.MINT_PRICE_WEI();
        uint256 share = (price * minter.BUILDER_BPS()) / minter.BPS();

        vm.deal(minterAddr, price);
        uint256 ownerStart = owner.balance;
        uint256 receiverBStart = receiverB.balance;

        vm.prank(minterAddr);
        minter.mintBuilders{ value: price }(refs);

        assertEq(receiverB.balance - receiverBStart, share);
        assertEq(owner.balance - ownerStart, price - share);
    }

    function testBuilderMintRejectsInvalidPrice() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price + 1);

        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.InvalidMintPrice.selector,
                price,
                price + 1
            )
        );
        minter.mintBuilders{ value: price + 1 }(refs);
        vm.stopPrank();
    }

    function testBuilderMintRejectsTooManyRefs() public {
        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price);

        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](
            minter.MAX_REFERENCES() + 1
        );
        vm.startPrank(minterAddr);
        for (uint256 i = 0; i < refs.length; i += 1) {
            uint256 tokenId = nftA.mint(minterAddr);
            refs[i] = CubixlesBuilderMinter.NftRef({
                contractAddress: address(nftA),
                tokenId: tokenId
            });
        }
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.InvalidReferenceCount.selector,
                refs.length
            )
        );
        minter.mintBuilders{ value: price }(refs);
        vm.stopPrank();
    }

    function testBuilderMintRequiresERC721() public {
        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](1);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftRoyaltyOnly),
            tokenId: 1
        });

        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.ReferenceNotERC721.selector,
                address(nftRoyaltyOnly)
            )
        );
        minter.mintBuilders{ value: price }(refs);
        vm.stopPrank();
    }

    function testBuilderMintRequiresERC2981() public {
        vm.startPrank(minterAddr);
        uint256 tokenId = nftNoRoyalty.mint(minterAddr);
        vm.stopPrank();

        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](1);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftNoRoyalty),
            tokenId: tokenId
        });

        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.ReferenceNotERC2981.selector,
                address(nftNoRoyalty)
            )
        );
        minter.mintBuilders{ value: price }(refs);
        vm.stopPrank();
    }

    function testBuilderMintRejectsOwnerOfRevert() public {
        uint256 tokenId = 42;
        nftOwnerRevert.mint(minterAddr, tokenId);

        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](1);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftOwnerRevert),
            tokenId: tokenId
        });

        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.RefOwnershipCheckFailed.selector,
                address(nftOwnerRevert),
                tokenId
            )
        );
        minter.mintBuilders{ value: price }(refs);
        vm.stopPrank();
    }

    function testBuilderMintRequiresOwner() public {
        uint256 tokenId = nftA.mint(owner);
        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](1);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftA),
            tokenId: tokenId
        });

        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.RefNotOwned.selector,
                address(nftA),
                tokenId,
                minterAddr,
                owner
            )
        );
        minter.mintBuilders{ value: price }(refs);
        vm.stopPrank();
    }

    function testBuilderMintRejectsRoyaltyInfoRevert() public {
        vm.startPrank(minterAddr);
        uint256 tokenId = nftRoyaltyRevert.mint(minterAddr);
        vm.stopPrank();

        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](1);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftRoyaltyRevert),
            tokenId: tokenId
        });

        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.RoyaltyInfoFailed.selector,
                address(nftRoyaltyRevert),
                tokenId
            )
        );
        minter.mintBuilders{ value: price }(refs);
        vm.stopPrank();
    }

    function testBuilderMintRejectsZeroRoyaltyReceiver() public {
        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](1);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftRoyaltyZero),
            tokenId: nftRoyaltyZero.mint(minterAddr)
        });

        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.RoyaltyReceiverRequired.selector,
                address(nftRoyaltyZero),
                refs[0].tokenId
            )
        );
        minter.mintBuilders{ value: price }(refs);
        vm.stopPrank();
    }

    function testBuilderMintRejectsInvalidRefCount() public {
        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](0);
        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.InvalidReferenceCount.selector,
                0
            )
        );
        minter.mintBuilders{ value: price }(refs);
        vm.stopPrank();
    }

    function testBuilderMintStoresRefs() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256 price = minter.MINT_PRICE_WEI();
        vm.deal(minterAddr, price);

        vm.prank(minterAddr);
        uint256 tokenId = minter.mintBuilders{ value: price }(refs);

        CubixlesBuilderMinter.NftRef[] memory stored = minter.getTokenRefs(tokenId);
        assertEq(stored.length, refs.length);
        assertEq(stored[0].contractAddress, refs[0].contractAddress);
        assertEq(stored[0].tokenId, refs[0].tokenId);
    }

    function testBuilderMintSetBaseUriOnlyOwner() public {
        vm.startPrank(minterAddr);
        vm.expectRevert();
        minter.setBaseURI("ipfs://new/");
        vm.stopPrank();

        vm.prank(owner);
        minter.setBaseURI("ipfs://new/");
    }
}
