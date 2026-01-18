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
import { BuilderRoyaltyForwarder } from "../src/royalties/BuilderRoyaltyForwarder.sol";

contract BuilderMinterTest is Test {
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 private constant REF_TYPEHASH =
        keccak256("NftRef(address contractAddress,uint256 tokenId)");
    bytes32 private constant QUOTE_TYPEHASH =
        keccak256(
            "BuilderQuote(bytes32 refsHash,bytes32 floorsHash,uint256 totalFloorWei,uint256 chainId,uint256 expiresAt,uint256 nonce)"
        );

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
    uint256 private quoteSignerKey;
    address private quoteSigner;
    address private receiverA = makeAddr("receiverA");
    address private receiverB = makeAddr("receiverB");
    address private receiverC = makeAddr("receiverC");

    function setUp() public {
        vm.prank(owner);
        minter = new CubixlesBuilderMinter("Cubixles Builders", "BLDR", "ipfs://base/");
        BuilderRoyaltyForwarder forwarder = new BuilderRoyaltyForwarder();
        vm.prank(owner);
        minter.setRoyaltyForwarderImpl(address(forwarder));
        quoteSignerKey = 0xB0B;
        quoteSigner = vm.addr(quoteSignerKey);
        vm.prank(owner);
        minter.setQuoteSigner(quoteSigner);

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

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("CubixlesBuilderMinter")),
                keccak256(bytes("1")),
                block.chainid,
                address(minter)
            )
        );
    }

    function _hashRefs(
        CubixlesBuilderMinter.NftRef[] memory refs
    ) internal pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](refs.length);
        for (uint256 i = 0; i < refs.length; i += 1) {
            hashes[i] = keccak256(
                abi.encode(REF_TYPEHASH, refs[i].contractAddress, refs[i].tokenId)
            );
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function _hashFloors(uint256[] memory floorsWei) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(floorsWei));
    }

    function _buildQuote(
        CubixlesBuilderMinter.NftRef[] memory refs,
        uint256[] memory floorsWei,
        uint256 nonce
    )
        internal
        view
        returns (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 mintPrice
        )
    {
        uint256 totalFloor = (minter.MAX_REFERENCES() - refs.length) * minter.MIN_FLOOR_WEI();
        for (uint256 i = 0; i < floorsWei.length; i += 1) {
            uint256 floor = floorsWei[i] == 0 ? minter.MIN_FLOOR_WEI() : floorsWei[i];
            totalFloor += floor;
        }
        mintPrice = (totalFloor * minter.PRICE_BPS()) / minter.BPS();
        quote = CubixlesBuilderMinter.BuilderQuote({
            totalFloorWei: totalFloor,
            chainId: block.chainid,
            expiresAt: block.timestamp + 1 days,
            nonce: nonce
        });

        signature = _signQuote(refs, floorsWei, quote, quoteSignerKey);
    }

    function _signQuote(
        CubixlesBuilderMinter.NftRef[] memory refs,
        uint256[] memory floorsWei,
        CubixlesBuilderMinter.BuilderQuote memory quote,
        uint256 signerKey
    ) internal view returns (bytes memory signature) {
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
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function testBuilderMintPaysRoyaltyReceivers() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 2 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        uint256 share = (price * minter.BUILDER_BPS()) / minter.BPS();

        vm.deal(minterAddr, price);
        uint256 ownerStart = owner.balance;
        uint256 receiverAStart = receiverA.balance;
        uint256 receiverBStart = receiverB.balance;

        vm.prank(minterAddr);
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);

        assertEq(receiverA.balance - receiverAStart, share);
        assertEq(receiverB.balance - receiverBStart, share);
        assertEq(owner.balance - ownerStart, price - (share * refs.length));
        assertEq(minter.ownerOf(1), minterAddr);
    }

    function testBuilderMintFallbackToOwnerOnReceiverRevert() public {
        ReceiverRevertsOnReceive badReceiver = new ReceiverRevertsOnReceive();
        nftA.setRoyalty(address(badReceiver), 500);
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 2 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        uint256 share = (price * minter.BUILDER_BPS()) / minter.BPS();

        vm.deal(minterAddr, price);
        uint256 ownerStart = owner.balance;
        uint256 receiverBStart = receiverB.balance;

        vm.prank(minterAddr);
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);

        assertEq(receiverB.balance - receiverBStart, share);
        assertEq(owner.balance - ownerStart, price - share);
    }

    function testBuilderMintZeroFloorSkipsRoyalty() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 0;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        uint256 share = (price * minter.BUILDER_BPS()) / minter.BPS();

        vm.deal(minterAddr, price);
        uint256 ownerStart = owner.balance;
        uint256 receiverAStart = receiverA.balance;
        uint256 receiverBStart = receiverB.balance;

        vm.prank(minterAddr);
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);

        assertEq(receiverA.balance - receiverAStart, 0);
        assertEq(receiverB.balance - receiverBStart, share);
        assertEq(owner.balance - ownerStart, price - share);
    }

    function testBuilderMintRejectsInvalidPrice() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 2 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        vm.deal(minterAddr, price + 1);

        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.InvalidMintPrice.selector,
                price,
                price + 1
            )
        );
        minter.mintBuilders{ value: price + 1 }(refs, floorsWei, quote, signature);
        vm.stopPrank();
    }

    function testBuilderMintRejectsInvalidSigner() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 1 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            ,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 2);

        uint256 badKey = 0xBAD;
        address badSigner = vm.addr(badKey);
        bytes memory badSignature = _signQuote(refs, floorsWei, quote, badKey);

        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.InvalidQuoteSigner.selector,
                badSigner
            )
        );
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, badSignature);
        vm.stopPrank();
    }

    function testBuilderMintRejectsUsedNonce() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 1 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 3);

        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);

        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.QuoteNonceUsed.selector,
                quote.nonce
            )
        );
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
    }

    function testBuilderMintRejectsExpiredQuote() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 1 ether;
        floorsWei[1] = 1 ether;
        uint256 totalFloor =
            (minter.MAX_REFERENCES() - refs.length) * minter.MIN_FLOOR_WEI() +
            floorsWei[0] +
            floorsWei[1];
        CubixlesBuilderMinter.BuilderQuote memory quote = CubixlesBuilderMinter.BuilderQuote({
            totalFloorWei: totalFloor,
            chainId: block.chainid,
            expiresAt: block.timestamp - 1,
            nonce: 4
        });
        bytes memory signature = _signQuote(refs, floorsWei, quote, quoteSignerKey);
        uint256 price = (totalFloor * minter.PRICE_BPS()) / minter.BPS();

        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.QuoteExpired.selector,
                quote.expiresAt,
                block.timestamp
            )
        );
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
        vm.stopPrank();
    }

    function testBuilderMintRejectsTotalFloorMismatch() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 1 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            ,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 5);
        uint256 expectedTotal = quote.totalFloorWei;
        quote.totalFloorWei = quote.totalFloorWei + 1;
        bytes memory signature = _signQuote(refs, floorsWei, quote, quoteSignerKey);

        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.QuoteTotalFloorMismatch.selector,
                expectedTotal,
                quote.totalFloorWei
            )
        );
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
        vm.stopPrank();
    }

    function testBuilderMintRejectsFloorCountMismatch() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](1);
        floorsWei[0] = 1 ether;

        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.InvalidFloorCount.selector,
                refs.length,
                floorsWei.length
            )
        );
        minter.mintBuilders(refs, floorsWei, CubixlesBuilderMinter.BuilderQuote(0, 0, 0, 0), "");
        vm.stopPrank();
    }

    function testBuilderMintRejectsTooManyRefs() public {
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
        minter.mintBuilders(refs, new uint256[](0), CubixlesBuilderMinter.BuilderQuote(0, 0, 0, 0), "");
        vm.stopPrank();
    }

    function testBuilderMintRequiresERC721() public {
        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](1);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftRoyaltyOnly),
            tokenId: 1
        });

        uint256[] memory floorsWei = new uint256[](1);
        floorsWei[0] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.ReferenceNotERC721.selector,
                address(nftRoyaltyOnly)
            )
        );
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
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

        uint256[] memory floorsWei = new uint256[](1);
        floorsWei[0] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.ReferenceNotERC2981.selector,
                address(nftNoRoyalty)
            )
        );
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
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

        uint256[] memory floorsWei = new uint256[](1);
        floorsWei[0] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.RefOwnershipCheckFailed.selector,
                address(nftOwnerRevert),
                tokenId
            )
        );
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
        vm.stopPrank();
    }

    function testBuilderMintRequiresOwner() public {
        uint256 tokenId = nftA.mint(owner);
        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](1);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftA),
            tokenId: tokenId
        });

        uint256[] memory floorsWei = new uint256[](1);
        floorsWei[0] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
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
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
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

        uint256[] memory floorsWei = new uint256[](1);
        floorsWei[0] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.RoyaltyInfoFailed.selector,
                address(nftRoyaltyRevert),
                tokenId
            )
        );
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
        vm.stopPrank();
    }

    function testBuilderMintRejectsZeroRoyaltyReceiver() public {
        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](1);
        refs[0] = CubixlesBuilderMinter.NftRef({
            contractAddress: address(nftRoyaltyZero),
            tokenId: nftRoyaltyZero.mint(minterAddr)
        });

        uint256[] memory floorsWei = new uint256[](1);
        floorsWei[0] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        vm.deal(minterAddr, price);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.RoyaltyReceiverRequired.selector,
                address(nftRoyaltyZero),
                refs[0].tokenId
            )
        );
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
        vm.stopPrank();
    }

    function testBuilderMintRejectsInvalidRefCount() public {
        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](0);
        vm.startPrank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.InvalidReferenceCount.selector,
                0
            )
        );
        minter.mintBuilders(refs, new uint256[](0), CubixlesBuilderMinter.BuilderQuote(0, 0, 0, 0), "");
        vm.stopPrank();
    }

    function testBuilderMintStoresRefs() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 2 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        vm.deal(minterAddr, price);

        vm.prank(minterAddr);
        uint256 tokenId = minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);

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

    function testBuilderMintWithMetadataStoresState() public {
        assertEq(minter.nextTokenId(), 1);
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 2 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 9);
        bytes32 metadataHash = keccak256("builder-metadata");
        string memory tokenUri = "ipfs://metadata/1";

        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mintBuildersWithMetadata{ value: price }(
            refs,
            floorsWei,
            quote,
            signature,
            tokenUri,
            metadataHash,
            1
        );

        assertEq(tokenId, 1);
        assertEq(minter.tokenURI(tokenId), tokenUri);
        assertEq(minter.metadataHashByTokenId(tokenId), metadataHash);
        assertEq(minter.mintPriceByTokenId(tokenId), price);
        uint256[] memory storedFloors = minter.getTokenFloors(tokenId);
        assertEq(storedFloors.length, floorsWei.length);
        assertEq(storedFloors[0], floorsWei[0]);
        assertEq(minter.nextTokenId(), tokenId + 1);
    }

    function testBuilderMintWithMetadataRequiresTokenUri() public {
        vm.expectRevert(CubixlesBuilderMinter.TokenUriRequired.selector);
        minter.mintBuildersWithMetadata(
            new CubixlesBuilderMinter.NftRef[](0),
            new uint256[](0),
            CubixlesBuilderMinter.BuilderQuote(0, 0, 0, 0),
            "",
            "",
            bytes32(0),
            0
        );
    }

    function testBuilderMintWithMetadataRequiresMetadataHash() public {
        vm.expectRevert(CubixlesBuilderMinter.MetadataHashRequired.selector);
        minter.mintBuildersWithMetadata(
            new CubixlesBuilderMinter.NftRef[](0),
            new uint256[](0),
            CubixlesBuilderMinter.BuilderQuote(0, 0, 0, 0),
            "",
            "ipfs://metadata/1",
            bytes32(0),
            0
        );
    }

    function testBuilderMintWithMetadataRejectsExpectedTokenIdMismatch() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 1 ether;
        floorsWei[1] = 1 ether;
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.ExpectedTokenIdMismatch.selector,
                2,
                1
            )
        );
        minter.mintBuildersWithMetadata(
            refs,
            floorsWei,
            CubixlesBuilderMinter.BuilderQuote(0, 0, 0, 0),
            "",
            "ipfs://metadata/1",
            keccak256("metadata"),
            2
        );
    }

    function testBuilderTokenUriUsesBaseWhenNoOverride() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 1 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 10);
        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);

        assertEq(minter.tokenURI(1), string.concat("ipfs://base/", "1"));
    }

    function testBuilderMintRequiresQuoteSigner() public {
        vm.prank(owner);
        CubixlesBuilderMinter noSigner =
            new CubixlesBuilderMinter("Cubixles Builders", "BLDR", "ipfs://base/");
        BuilderRoyaltyForwarder forwarder = new BuilderRoyaltyForwarder();
        vm.prank(owner);
        noSigner.setRoyaltyForwarderImpl(address(forwarder));
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 1 ether;
        floorsWei[1] = 1 ether;
        CubixlesBuilderMinter.BuilderQuote memory quote = CubixlesBuilderMinter.BuilderQuote({
            totalFloorWei: 0,
            chainId: block.chainid,
            expiresAt: block.timestamp + 1 days,
            nonce: 1
        });

        vm.prank(minterAddr);
        vm.expectRevert(CubixlesBuilderMinter.QuoteSignerRequired.selector);
        noSigner.mintBuilders(refs, floorsWei, quote, "");
    }

    function testBuilderMintRejectsChainIdMismatch() public {
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 1 ether;
        floorsWei[1] = 1 ether;
        CubixlesBuilderMinter.BuilderQuote memory quote = CubixlesBuilderMinter.BuilderQuote({
            totalFloorWei: 0,
            chainId: block.chainid + 1,
            expiresAt: block.timestamp + 1 days,
            nonce: 1
        });

        vm.prank(minterAddr);
        vm.expectRevert(
            abi.encodeWithSelector(
                CubixlesBuilderMinter.QuoteChainIdMismatch.selector,
                block.chainid,
                block.chainid + 1
            )
        );
        minter.mintBuilders(refs, floorsWei, quote, "");
    }

    function testBuilderMintZeroRoyaltyAmountDoesNotRevert() public {
        nftA.setRoyalty(receiverA, 0);
        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 1 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 11);

        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);
    }

    function testBuilderSetQuoteSignerRevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(CubixlesBuilderMinter.ZeroAddress.selector);
        minter.setQuoteSigner(address(0));
    }

    function testBuilderWithdrawOwnerBalanceNoopWhenZero() public {
        vm.prank(owner);
        minter.withdrawOwnerBalance(payable(owner));
    }

    function testBuilderWithdrawOwnerBalanceTransfersPending() public {
        ReceiverRevertsOnReceive badOwner = new ReceiverRevertsOnReceive();
        vm.prank(owner);
        minter.transferOwnership(address(badOwner));

        CubixlesBuilderMinter.NftRef[] memory refs = _mintRefs();
        uint256[] memory floorsWei = new uint256[](2);
        floorsWei[0] = 2 ether;
        floorsWei[1] = 1 ether;
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 12);

        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        minter.mintBuilders{ value: price }(refs, floorsWei, quote, signature);

        uint256 pending = minter.pendingOwnerBalance();
        assertGt(pending, 0);

        uint256 recipientStart = owner.balance;
        vm.prank(address(badOwner));
        minter.withdrawOwnerBalance(payable(owner));
        assertEq(minter.pendingOwnerBalance(), 0);
        assertEq(owner.balance - recipientStart, pending);
    }
}
