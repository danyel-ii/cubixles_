// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RoyaltySplitter is Ownable, ReentrancyGuard {
    address public immutable lessToken;
    address public router;
    bytes public swapCalldata;

    event RouterUpdated(address router, bytes swapCalldata);

    constructor(
        address owner_,
        address lessToken_,
        address router_,
        bytes memory swapCalldata_
    ) Ownable(owner_) {
        require(owner_ != address(0), "Owner required");
        lessToken = lessToken_;
        router = router_;
        swapCalldata = swapCalldata_;
    }

    receive() external payable nonReentrant {
        _handleRoyalty();
    }

    fallback() external payable nonReentrant {
        _handleRoyalty();
    }

    function setRouter(address router_, bytes calldata swapCalldata_) external onlyOwner {
        router = router_;
        swapCalldata = swapCalldata_;
        emit RouterUpdated(router_, swapCalldata_);
    }

    function _handleRoyalty() internal {
        uint256 amount = msg.value;
        if (amount == 0) {
            return;
        }

        if (router == address(0)) {
            _send(owner(), amount);
            return;
        }

        uint256 half = amount / 2;
        (bool ok, ) = router.call{ value: half }(swapCalldata);
        if (!ok) {
            _send(owner(), amount);
            return;
        }

        _forwardLessToOwner();
        _send(owner(), address(this).balance);
    }

    function _forwardLessToOwner() internal {
        uint256 lessBalance = IERC20(lessToken).balanceOf(address(this));
        if (lessBalance == 0) {
            return;
        }
        bool success = IERC20(lessToken).transfer(owner(), lessBalance);
        require(success, "LESS transfer failed");
    }

    function _send(address recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        (bool success, ) = recipient.call{ value: amount }("");
        require(success, "Transfer failed");
    }
}
