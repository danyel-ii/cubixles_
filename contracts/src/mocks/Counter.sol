// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/// @title Counter
/// @notice Simple counter used for tests.
/// @author cubeless
contract Counter {
    /// @notice Stored counter value.
    uint256 public number;

    /// @notice Set the stored number.
    /// @param newNumber New value to store.
    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    /// @notice Increment the stored number.
    function increment() public {
        number++;
    }
}
