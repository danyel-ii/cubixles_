// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Receiver that always reverts to block mint payouts.
contract MintBlocker {
    error MintDisabled();

    receive() external payable {
        revert MintDisabled();
    }

    fallback() external payable {
        revert MintDisabled();
    }
}
