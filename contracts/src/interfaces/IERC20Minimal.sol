// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IERC20Minimal
/// @notice Minimal ERC20 surface used for total supply reads.
interface IERC20Minimal {
    /// @notice Returns the total token supply.
    function totalSupply() external view returns (uint256);
}
