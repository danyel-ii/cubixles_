// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IBuilderRoyaltyForwarder } from "../interfaces/IBuilderRoyaltyForwarder.sol";

/// @title BuilderRoyaltyForwarder
/// @notice Per-mint royalty receiver that forwards ETH to configurable splits.
/// @dev Default behavior forwards 100% to the owner (minting wallet).
contract BuilderRoyaltyForwarder is IBuilderRoyaltyForwarder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Split {
        address recipient;
        uint16 bps;
    }

    uint16 public constant BPS = 10_000;

    bool private _initialized;
    Split[] private _splits;
    mapping(address => uint256) public pending;

    error AlreadyInitialized();
    error OwnerRequired();
    error SplitLengthMismatch(uint256 recipients, uint256 bps);
    error SplitRecipientRequired();
    error SplitBpsTooHigh(uint256 totalBps);
    error PendingBalanceEmpty();
    error PendingWithdrawFailed();
    error SweepRecipientRequired();

    event ForwarderInitialized(address indexed owner);
    event SplitsUpdated(address[] recipients, uint16[] bps);
    event RoyaltyPayout(address indexed recipient, uint256 amount, bool pending);
    event PendingWithdrawn(address indexed recipient, uint256 amount);
    event TokenSwept(address indexed token, address indexed recipient, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function initialize(address owner_) external override {
        if (_initialized) {
            revert AlreadyInitialized();
        }
        if (owner_ == address(0)) {
            revert OwnerRequired();
        }
        _initialized = true;
        _transferOwnership(owner_);
        emit ForwarderInitialized(owner_);
    }

    receive() external payable nonReentrant {
        _distribute(msg.value);
    }

    fallback() external payable nonReentrant {
        _distribute(msg.value);
    }

    function setSplits(address[] calldata recipients, uint16[] calldata bps) external onlyOwner {
        if (recipients.length != bps.length) {
            revert SplitLengthMismatch(recipients.length, bps.length);
        }
        uint256 totalBps = 0;
        uint256 length = recipients.length;
        for (uint256 i = 0; i < length; i += 1) {
            if (recipients[i] == address(0)) {
                revert SplitRecipientRequired();
            }
            totalBps += bps[i];
        }
        if (totalBps > BPS) {
            revert SplitBpsTooHigh(totalBps);
        }

        delete _splits;
        for (uint256 i = 0; i < length; i += 1) {
            _splits.push(Split({ recipient: recipients[i], bps: bps[i] }));
        }
        emit SplitsUpdated(recipients, bps);
    }

    function getSplits()
        external
        view
        returns (address[] memory recipients, uint16[] memory bps)
    {
        uint256 length = _splits.length;
        recipients = new address[](length);
        bps = new uint16[](length);
        for (uint256 i = 0; i < length; i += 1) {
            Split memory split = _splits[i];
            recipients[i] = split.recipient;
            bps[i] = split.bps;
        }
    }

    function withdrawPending() external nonReentrant {
        uint256 amount = pending[msg.sender];
        if (amount == 0) {
            revert PendingBalanceEmpty();
        }
        pending[msg.sender] = 0;
        if (!_send(msg.sender, amount)) {
            pending[msg.sender] = amount;
            revert PendingWithdrawFailed();
        }
        emit PendingWithdrawn(msg.sender, amount);
    }

    function sweepToken(address token, address recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) {
            revert SweepRecipientRequired();
        }
        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount <= 0) {
            return;
        }
        IERC20(token).safeTransfer(recipient, amount);
        emit TokenSwept(token, recipient, amount);
    }

    function _distribute(uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        if (_splits.length == 0) {
            _sendOrCredit(owner(), amount);
            return;
        }
        uint256 remaining = amount;
        uint256 length = _splits.length;
        for (uint256 i = 0; i < length; i += 1) {
            Split memory split = _splits[i];
            uint256 share = (amount * split.bps) / BPS;
            if (share == 0) {
                continue;
            }
            remaining -= share;
            _sendOrCredit(split.recipient, share);
        }
        if (remaining > 0) {
            _sendOrCredit(owner(), remaining);
        }
    }

    function _sendOrCredit(address recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        pending[recipient] += amount;
        if (_send(recipient, amount)) {
            pending[recipient] -= amount;
            emit RoyaltyPayout(recipient, amount, false);
            return;
        }
        emit RoyaltyPayout(recipient, amount, true);
    }

    function _send(address recipient, uint256 amount) internal returns (bool) {
        // slither-disable-next-line low-level-calls
        (bool success, ) = payable(recipient).call{ value: amount }("");
        return success;
    }
}
