// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";
import { IceCubeMinter } from "../../src/icecube/IceCubeMinter.sol";
import { MockERC721Standard } from "../mocks/MockERC721s.sol";

contract MintHandler is Test {
    IceCubeMinter public minter;
    MockERC721Standard public nft;
    uint256 public mintCount;
    uint256 public lastTokenId;
    uint256 public immutable mintPrice;

    constructor(IceCubeMinter minter_, MockERC721Standard nft_, uint256 mintPrice_) {
        minter = minter_;
        nft = nft_;
        mintPrice = mintPrice_;
        vm.deal(address(this), 100 ether);
    }

    function mintOnce(uint8 countRaw) external {
        uint8 count = uint8((uint256(countRaw) % 6) + 1);
        IceCubeMinter.NftRef[] memory refs = new IceCubeMinter.NftRef[](count);
        for (uint256 i = 0; i < count; i += 1) {
            uint256 mintedId = nft.mint(address(this));
            refs[i] = IceCubeMinter.NftRef({
                contractAddress: address(nft),
                tokenId: mintedId
            });
        }
        uint256 tokenId = minter.mint{ value: mintPrice }("ipfs://token", refs);
        mintCount += 1;
        lastTokenId = tokenId;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

contract IceCubeMinterInvariants is StdInvariant, Test {
    IceCubeMinter private minter;
    MockERC721Standard private nft;
    MintHandler private handler;

    address private owner = makeAddr("owner");
    address private resaleSplitter = makeAddr("splitter");
    uint256 private constant MINT_PRICE = 0.0017 ether;

    function setUp() public {
        vm.prank(owner);
        minter = new IceCubeMinter(resaleSplitter, 500);
        nft = new MockERC721Standard("MockNFT", "MNFT");
        handler = new MintHandler(minter, nft, MINT_PRICE);
        targetContract(address(handler));
    }

    function invariant_ownerBalanceMatchesMintCount() public {
        assertEq(owner.balance, handler.mintCount() * MINT_PRICE);
    }

    function invariant_tokenIdsMonotonic() public {
        if (handler.mintCount() == 0) {
            return;
        }
        assertEq(handler.lastTokenId(), handler.mintCount());
    }

    function invariant_royaltyInfoReceiver() public {
        (address receiver, uint256 amount) = minter.royaltyInfo(1, 1 ether);
        assertEq(receiver, resaleSplitter);
        assertEq(amount, 0.05 ether);
    }
}
