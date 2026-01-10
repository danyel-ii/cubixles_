// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { MintBlocker } from "../src/maintenance/MintBlocker.sol";

contract MintBlockerTest is Test {
    function testReceiveReverts() public {
        MintBlocker blocker = new MintBlocker();
        vm.deal(address(this), 1 ether);
        (bool success, ) = address(blocker).call{ value: 0.1 ether }("");
        assertTrue(!success);
    }

    function testFallbackReverts() public {
        MintBlocker blocker = new MintBlocker();
        vm.deal(address(this), 1 ether);
        (bool success, ) = address(blocker).call{ value: 0.1 ether }(hex"deadbeef");
        assertTrue(!success);
    }
}
