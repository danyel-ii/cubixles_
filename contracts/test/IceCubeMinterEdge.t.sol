// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IceCubeMinter } from "../src/icecube/IceCubeMinter.sol";
import {
    MockERC721Standard,
    MockERC721RevertingOwnerOf,
    MockERC721ReturnsWrongOwner
} from "./mocks/MockERC721s.sol";
import {
    ReceiverRevertsOnReceive,
    ReceiverConsumesGasOnReceive,
    MaliciousReceiverReenter
} from "./mocks/Receivers.sol";

contract RefundRevertsOnReceive {
    IceCubeMinter public minter;
    IceCubeMinter.NftRef[] public refs;

    constructor(IceCubeMinter minter_) {
        minter = minter_;
    }

    receive() external payable {
        revert("Refund rejected");
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function configure(IceCubeMinter.NftRef[] calldata refs_) external {
        delete refs;
        for (uint256 i = 0; i < refs_.length; i += 1) {
            refs.push(refs_[i]);
        }
    }

    function mintWithOverpay(string calldata tokenUri) external payable {
        minter.mint{ value: msg.value }(tokenUri, refs);
    }
}

contract IceCubeMinterEdgeTest is Test {
    IceCubeMinter private minter;
    MockERC721Standard private nft;
    address private owner = makeAddr("owner");
    address private resaleSplitter = makeAddr("splitter");
    uint256 private constant MINT_PRICE = 0.0017 ether;

    function setUp() public {
        vm.startPrank(owner);
        minter = new IceCubeMinter(resaleSplitter, 500);
        vm.stopPrank();
        nft = new MockERC721Standard("MockNFT", "MNFT");
    }

    function testMintRevertsWhenOwnerReceiveFails() public {
        ReceiverRevertsOnReceive receiver = new ReceiverRevertsOnReceive();
        vm.prank(owner);
        minter.transferOwnership(address(receiver));

        address minterAddr = makeAddr("minter");
        uint256 tokenId = nft.mint(minterAddr);
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });

        vm.deal(minterAddr, MINT_PRICE);
        vm.prank(minterAddr);
        vm.expectRevert("Transfer failed");
        minter.mint{ value: MINT_PRICE }("ipfs://token", refs);
    }

    function testMintRevertsWhenRefundFails() public {
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        RefundRevertsOnReceive refundReverter = new RefundRevertsOnReceive(minter);
        uint256 tokenId = nft.mint(address(refundReverter));
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });
        refundReverter.configure(refs);
        vm.deal(address(refundReverter), MINT_PRICE + 1 wei);

        vm.expectRevert("Transfer failed");
        refundReverter.mintWithOverpay{ value: MINT_PRICE + 1 wei }("ipfs://token");
    }

    function testOwnerOfRevertBubbles() public {
        MockERC721RevertingOwnerOf badNft = new MockERC721RevertingOwnerOf();
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(badNft), tokenId: 1 });

        vm.expectRevert();
        minter.mint("ipfs://token", refs);
    }

    function testWrongOwnerReverts() public {
        address wrongOwner = makeAddr("wrongOwner");
        MockERC721ReturnsWrongOwner badNft = new MockERC721ReturnsWrongOwner(wrongOwner);
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(badNft), tokenId: 1 });

        vm.expectRevert("Not owner of referenced NFT");
        minter.mint("ipfs://token", refs);
    }

    function testMintTokenIdMonotonic() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenIdA = nft.mint(minterAddr);
        uint256 tokenIdB = nft.mint(minterAddr);
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nft), tokenId: tokenIdA });

        vm.deal(minterAddr, MINT_PRICE * 2);
        vm.startPrank(minterAddr);
        uint256 mintedA = minter.mint{ value: MINT_PRICE }("ipfs://a", refs);
        refs[0].tokenId = tokenIdB;
        uint256 mintedB = minter.mint{ value: MINT_PRICE }("ipfs://b", refs);
        vm.stopPrank();

        assertEq(mintedB, mintedA + 1);
    }

    function testMintSucceedsWithGasHeavyOwner() public {
        ReceiverConsumesGasOnReceive gasOwner = new ReceiverConsumesGasOnReceive();
        vm.prank(owner);
        minter.transferOwnership(address(gasOwner));

        address minterAddr = makeAddr("minter");
        uint256 tokenId = nft.mint(minterAddr);
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });

        vm.deal(minterAddr, MINT_PRICE);
        vm.prank(minterAddr);
        minter.mint{ value: MINT_PRICE }("ipfs://token", refs);
        assertEq(address(gasOwner).balance, MINT_PRICE);
    }

    function testMintRevertsOnReentrantOwnerReceive() public {
        MaliciousReceiverReenter malicious = new MaliciousReceiverReenter();
        vm.prank(owner);
        minter.transferOwnership(address(malicious));

        address minterAddr = makeAddr("minter");
        uint256 tokenId = nft.mint(minterAddr);
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });

        address[] memory reenterContracts = new address[](1);
        uint256[] memory reenterTokenIds = new uint256[](1);
        reenterContracts[0] = address(nft);
        reenterTokenIds[0] = tokenId;
        malicious.configure(minter, reenterContracts, reenterTokenIds, "ipfs://reenter");

        vm.deal(minterAddr, MINT_PRICE);
        vm.prank(minterAddr);
        uint256 mintedId = minter.mint{ value: MINT_PRICE }("ipfs://token", refs);
        assertEq(minter.ownerOf(mintedId), minterAddr);
    }
}
