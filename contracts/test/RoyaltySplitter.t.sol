// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { RoyaltySplitter } from "../src/royalties/RoyaltySplitter.sol";
import { ReceiverRevertsOnReceive } from "./mocks/Receivers.sol";

contract RevertingRouter {
    fallback() external payable {
        revert("Swap failed");
    }
}

contract MockLess is ERC20 {
    constructor() ERC20("LESS", "LESS") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract SuccessfulRouter {
    MockLess public immutable less;
    uint256 public immutable mintAmount;

    constructor(MockLess less_, uint256 mintAmount_) {
        less = less_;
        mintAmount = mintAmount_;
    }

    fallback() external payable {
        less.mint(msg.sender, mintAmount);
    }
}

contract RoyaltySplitterTest is Test {
    address private owner = makeAddr("owner");

    function testForwardsAllWhenRouterUnset() public {
        RoyaltySplitter splitter = new RoyaltySplitter(owner, address(0), address(0), "");
        vm.deal(address(this), 1 ether);

        (bool ok, ) = address(splitter).call{ value: 1 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testForwardsAllWhenSwapReverts() public {
        RevertingRouter router = new RevertingRouter();
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(0),
            address(router),
            hex"deadbeef"
        );

        vm.deal(address(this), 2 ether);
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 2 ether);
    }

    function testForwardsLessAndEthOnSwapSuccess() public {
        MockLess less = new MockLess();
        SuccessfulRouter router = new SuccessfulRouter(less, 250 ether);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(router),
            hex"deadbeef"
        );

        vm.deal(address(this), 2 ether);
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
        assertEq(less.balanceOf(owner), 250 ether);
    }

    function testRevertsWhenOwnerCannotReceiveEth() public {
        ReceiverRevertsOnReceive receiver = new ReceiverRevertsOnReceive();
        RoyaltySplitter splitter = new RoyaltySplitter(
            address(receiver),
            address(0),
            address(0),
            ""
        );

        vm.deal(address(this), 1 ether);
        vm.expectRevert("Transfer failed");
        address(splitter).call{ value: 1 ether }("");
    }
}
