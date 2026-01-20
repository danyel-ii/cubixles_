// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { CubixlesBuilderMinter } from "../../src/builders/CubixlesBuilderMinter.sol";
import { MockERC721Royalty } from "../mocks/MockERC721Royalty.sol";
import { BuilderRoyaltyForwarder } from "../../src/royalties/BuilderRoyaltyForwarder.sol";

contract BuilderMinterFuzzTest is Test {
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
    MockERC721Royalty[6] private nfts;
    uint256[6] private tokenIds;
    address[6] private receivers;

    address private owner = makeAddr("owner");
    address private minterAddr = makeAddr("minter");
    uint256 private quoteSignerKey;
    address private quoteSigner;

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
        uint256 totalFloor = 0;
        for (uint256 i = 0; i < floorsWei.length; i += 1) {
            uint256 floor =
                floorsWei[i] < minter.MIN_FLOOR_WEI() ? minter.MIN_FLOOR_WEI() : floorsWei[i];
            totalFloor += floor;
        }
        mintPrice =
            minter.BASE_MINT_PRICE_WEI() +
            (totalFloor * minter.PRICE_BPS()) / minter.BPS();
        quote = CubixlesBuilderMinter.BuilderQuote({
            totalFloorWei: totalFloor,
            chainId: block.chainid,
            expiresAt: block.timestamp + 1 days,
            nonce: nonce
        });

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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(quoteSignerKey, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function testFuzzBuilderMintDistribution(uint8 refCount) public {
        vm.assume(refCount >= 1 && refCount <= 6);

        CubixlesBuilderMinter.NftRef[] memory refs = new CubixlesBuilderMinter.NftRef[](refCount);
        uint256[] memory floorsWei = new uint256[](refCount);
        for (uint256 i = 0; i < refCount; i += 1) {
            refs[i] = CubixlesBuilderMinter.NftRef({
                contractAddress: address(nfts[i]),
                tokenId: tokenIds[i]
            });
            floorsWei[i] = 1 ether;
        }
        (
            CubixlesBuilderMinter.BuilderQuote memory quote,
            bytes memory signature,
            uint256 price
        ) = _buildQuote(refs, floorsWei, 1);
        uint256 share = (price * minter.BUILDER_BPS()) / minter.BPS();

        uint256 ownerStart = owner.balance;
        uint256[] memory receiverStarts = new uint256[](refCount);
        for (uint256 i = 0; i < refCount; i += 1) {
            receiverStarts[i] = receivers[i].balance;
        }

        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        uint256 tokenId = minter.mintBuilders{ value: price }(
            refs,
            floorsWei,
            quote,
            signature
        );

        for (uint256 i = 0; i < refCount; i += 1) {
            assertEq(receivers[i].balance - receiverStarts[i], share);
        }
        assertEq(owner.balance - ownerStart, price - share * refCount);
        assertEq(minter.ownerOf(tokenId), minterAddr);
    }
}
