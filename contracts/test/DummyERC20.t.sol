// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { DummyERC20 } from "../src/mocks/DummyERC20.sol";

contract DummyERC20Test is Test {
    function testMintsToRecipientWhenProvided() public {
        address recipient = makeAddr("recipient");
        DummyERC20 token = new DummyERC20("Dummy", "DUM", recipient, 123);

        assertEq(token.name(), "Dummy");
        assertEq(token.symbol(), "DUM");
        assertEq(token.totalSupply(), 123);
        assertEq(token.balanceOf(recipient), 123);
    }

    function testSkipsMintWhenRecipientIsZero() public {
        DummyERC20 token = new DummyERC20("Dummy", "DUM", address(0), 123);

        assertEq(token.totalSupply(), 0);
    }

    function testSkipsMintWhenAmountIsZero() public {
        address recipient = makeAddr("recipient");
        DummyERC20 token = new DummyERC20("Dummy", "DUM", recipient, 0);

        assertEq(token.totalSupply(), 0);
        assertEq(token.balanceOf(recipient), 0);
    }
}
