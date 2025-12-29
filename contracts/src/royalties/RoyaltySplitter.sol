// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { IUnlockCallback } from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { PoolIdLibrary } from "@uniswap/v4-core/src/types/PoolId.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { BalanceDelta, BalanceDeltaLibrary } from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { StateLibrary } from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

contract RoyaltySplitter is Ownable, ReentrancyGuard, IUnlockCallback {
    using BalanceDeltaLibrary for BalanceDelta;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    address public immutable lessToken;
    address public immutable burnAddress;
    IPoolManager public immutable poolManager;
    PoolKey public poolKey;
    bool public swapEnabled;
    uint16 public swapMaxSlippageBps;
    uint16 public constant MAX_SWAP_SLIPPAGE_BPS = 1000;

    error LessTokenRequired();
    error PoolManagerRequired();
    error InvalidPoolKey();
    error InvalidSlippageBps();
    error PoolNotInitialized();
    error SwapOutputTooLow();
    error EthTransferFailed(address recipient, uint256 amount);
    error PoolManagerOnly();

    event SwapEnabledUpdated(bool enabled);
    event SwapSlippageUpdated(uint16 maxSlippageBps);
    event SwapFailedFallbackToOwner(uint256 amount, bytes32 reasonHash);

    constructor(
        address owner_,
        address lessToken_,
        IPoolManager poolManager_,
        PoolKey memory poolKey_,
        uint16 swapMaxSlippageBps_,
        address burnAddress_
    ) Ownable(owner_) {
        require(owner_ != address(0), "Owner required");
        require(burnAddress_ != address(0), "Burn address required");
        if (lessToken_ == address(0)) {
            revert LessTokenRequired();
        }
        if (Currency.unwrap(poolKey_.currency0) != address(0)) {
            revert InvalidPoolKey();
        }
        if (Currency.unwrap(poolKey_.currency1) != lessToken_) {
            revert InvalidPoolKey();
        }
        if (swapMaxSlippageBps_ > MAX_SWAP_SLIPPAGE_BPS) {
            revert InvalidSlippageBps();
        }
        lessToken = lessToken_;
        poolManager = poolManager_;
        poolKey = poolKey_;
        burnAddress = burnAddress_;
        swapEnabled = address(poolManager_) != address(0);
        swapMaxSlippageBps = swapMaxSlippageBps_;
    }

    receive() external payable nonReentrant {
        _handleRoyalty();
    }

    fallback() external payable nonReentrant {
        _handleRoyalty();
    }

    function setSwapEnabled(bool enabled) external onlyOwner {
        if (enabled && address(poolManager) == address(0)) {
            revert PoolManagerRequired();
        }
        if (enabled && !_poolInitialized()) {
            revert PoolNotInitialized();
        }
        swapEnabled = enabled;
        emit SwapEnabledUpdated(enabled);
    }

    function setSwapMaxSlippageBps(uint16 maxSlippageBps) external onlyOwner {
        if (maxSlippageBps > MAX_SWAP_SLIPPAGE_BPS) {
            revert InvalidSlippageBps();
        }
        swapMaxSlippageBps = maxSlippageBps;
        emit SwapSlippageUpdated(maxSlippageBps);
    }

    function _handleRoyalty() internal {
        uint256 amount = msg.value;
        if (amount == 0) {
            return;
        }

        if (!swapEnabled || address(poolManager) == address(0)) {
            _send(owner(), amount);
            return;
        }

        uint256 half = amount / 2;
        if (half == 0) {
            _send(owner(), amount);
            return;
        }

        try poolManager.unlock(abi.encode(half)) {
            _forwardLess();
            _send(owner(), address(this).balance);
        } catch (bytes memory reason) {
            emit SwapFailedFallbackToOwner(amount, keccak256(reason));
            _send(owner(), amount);
        }
    }

    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(poolManager)) {
            revert PoolManagerOnly();
        }
        uint256 amountIn = abi.decode(data, (uint256));
        if (amountIn == 0) {
            return bytes("");
        }

        uint160 sqrtPriceLimitX96 = TickMath.MIN_SQRT_PRICE + 1;
        if (swapMaxSlippageBps != 0) {
            (uint160 sqrtPriceX96, , , ) = poolManager.getSlot0(poolKey.toId());
            sqrtPriceLimitX96 = _slippageLimit(sqrtPriceX96);
        }
        BalanceDelta delta = poolManager.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: sqrtPriceLimitX96
            }),
            bytes("")
        );

        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();
        if (amount1 <= 0) {
            revert SwapOutputTooLow();
        }

        if (amount0 < 0) {
            poolManager.settle{ value: uint256(uint128(-amount0)) }();
        }
        if (amount1 > 0) {
            poolManager.take(poolKey.currency1, address(this), uint256(uint128(amount1)));
        }

        return abi.encode(amount0, amount1);
    }

    function _forwardLess() internal {
        uint256 lessBalance = IERC20(lessToken).balanceOf(address(this));
        if (lessBalance == 0) {
            return;
        }
        uint256 burnAmount = lessBalance / 2;
        uint256 ownerAmount = lessBalance - burnAmount;
        if (burnAmount > 0) {
            bool burned = IERC20(lessToken).transfer(burnAddress, burnAmount);
            require(burned, "LESS burn transfer failed");
        }
        if (ownerAmount > 0) {
            bool success = IERC20(lessToken).transfer(owner(), ownerAmount);
            require(success, "LESS transfer failed");
        }
    }

    function _send(address recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }
        (bool success, ) = recipient.call{ value: amount }("");
        if (!success) {
            revert EthTransferFailed(recipient, amount);
        }
    }

    function _slippageLimit(uint160 sqrtPriceX96) internal view returns (uint160) {
        if (swapMaxSlippageBps == 0) {
            return sqrtPriceX96;
        }
        uint256 bps = swapMaxSlippageBps;
        uint256 limit = (uint256(sqrtPriceX96) * (10_000 - bps)) / 10_000;
        if (limit <= TickMath.MIN_SQRT_PRICE) {
            return TickMath.MIN_SQRT_PRICE + 1;
        }
        return uint160(limit);
    }

    function _poolInitialized() internal view returns (bool) {
        if (address(poolManager) == address(0)) {
            return false;
        }
        (uint160 sqrtPriceX96, , , ) = poolManager.getSlot0(poolKey.toId());
        return sqrtPriceX96 != 0;
    }
}
