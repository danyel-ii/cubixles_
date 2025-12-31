// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DummyERC20
/// @notice Simple ERC20 used for tests.
/// @author cubixles_
contract DummyERC20 is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        address recipient,
        uint256 amount
    ) ERC20(name_, symbol_) {
        if (recipient != address(0) && amount > 0) {
            _mint(recipient, amount);
        }
    }
}
