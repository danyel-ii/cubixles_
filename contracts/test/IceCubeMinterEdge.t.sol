// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { IceCubeMinter } from "../src/icecube/IceCubeMinter.sol";
import {
    MockERC721Standard,
    MockERC721RevertingOwnerOf,
    MockERC721ReturnsWrongOwner
} from "./mocks/MockERC721s.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import {
    ReceiverRevertsOnReceive,
    ReceiverConsumesGasOnReceive,
    MaliciousReceiverReenter
} from "./mocks/Receivers.sol";

contract RefundRevertsOnReceive {
    IceCubeMinter public minter;
    IceCubeMinter.NftRef[] public refs;
    bytes32 public constant DEFAULT_SALT = keccak256("refund");

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
        minter.mint{ value: msg.value }(DEFAULT_SALT, tokenUri, refs);
    }
}

contract IceCubeMinterEdgeTest is Test {
    IceCubeMinter private minter;
    MockERC721Standard private nft;
    MockERC20 private lessToken;
    address private owner = makeAddr("owner");
    address private resaleSplitter = makeAddr("splitter");
    bytes32 private constant DEFAULT_SALT = keccak256("salt");

    function setUp() public {
        vm.startPrank(owner);
        lessToken = new MockERC20("LESS", "LESS");
        minter = new IceCubeMinter(resaleSplitter, address(lessToken), 500);
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

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        vm.expectRevert();
        minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testMintRevertsWhenRefundFails() public {
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        RefundRevertsOnReceive refundReverter = new RefundRevertsOnReceive(minter);
        uint256 tokenId = nft.mint(address(refundReverter));
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });
        refundReverter.configure(refs);
        uint256 price = minter.currentMintPrice();
        vm.deal(address(refundReverter), price + 1 wei);

        vm.expectRevert();
        refundReverter.mintWithOverpay{ value: price + 1 wei }("ipfs://token");
    }

    function testOwnerOfRevertBubbles() public {
        MockERC721RevertingOwnerOf badNft = new MockERC721RevertingOwnerOf();
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(badNft), tokenId: 1 });

        vm.expectRevert(
            abi.encodeWithSelector(
                IceCubeMinter.RefOwnershipCheckFailed.selector,
                address(badNft),
                1
            )
        );
        minter.mint(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testWrongOwnerReverts() public {
        address wrongOwner = makeAddr("wrongOwner");
        MockERC721ReturnsWrongOwner badNft = new MockERC721ReturnsWrongOwner(wrongOwner);
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(badNft), tokenId: 1 });

        vm.expectRevert(
            abi.encodeWithSelector(
                IceCubeMinter.RefNotOwned.selector,
                address(badNft),
                1,
                address(this),
                wrongOwner
            )
        );
        minter.mint(DEFAULT_SALT, "ipfs://token", refs);
    }

    function testTokenIdDiffersForDifferentSalts() public {
        address minterAddr = makeAddr("minter");
        uint256 tokenIdA = nft.mint(minterAddr);
        uint256 tokenIdB = nft.mint(minterAddr);
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nft), tokenId: tokenIdA });

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price * 2);
        vm.startPrank(minterAddr);
        uint256 mintedA = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://a", refs);
        refs[0].tokenId = tokenIdB;
        uint256 mintedB = minter.mint{ value: price }(keccak256("salt-b"), "ipfs://b", refs);
        vm.stopPrank();

        assertTrue(mintedA != mintedB);
    }

    function testMintSucceedsWithGasHeavyOwner() public {
        ReceiverConsumesGasOnReceive gasOwner = new ReceiverConsumesGasOnReceive();
        vm.prank(owner);
        minter.transferOwnership(address(gasOwner));

        address minterAddr = makeAddr("minter");
        uint256 tokenId = nft.mint(minterAddr);
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](1);
        refs[0] = IceCubeMinter.NftRef({ contractAddress: address(nft), tokenId: tokenId });

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);
        assertEq(address(gasOwner).balance, price);
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
        malicious.configure(
            minter,
            reenterContracts,
            reenterTokenIds,
            "ipfs://reenter",
            DEFAULT_SALT
        );

        uint256 price = minter.currentMintPrice();
        vm.deal(minterAddr, price);
        vm.prank(minterAddr);
        uint256 mintedId = minter.mint{ value: price }(DEFAULT_SALT, "ipfs://token", refs);
        assertEq(minter.ownerOf(mintedId), minterAddr);
    }
}
