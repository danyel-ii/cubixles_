// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { IUnlockCallback } from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { PoolIdLibrary } from "@uniswap/v4-core/src/types/PoolId.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { BalanceDelta, BalanceDeltaLibrary } from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { StateLibrary } from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title IWETH
/// @notice Minimal WETH interface for balance, transfer, and unwrap.
/// @author cubixles_
interface IWETH {
    /// @notice Returns the WETH balance for an account.
    /// @param account Account to query.
    /// @return balance WETH balance.
    function balanceOf(address account) external view returns (uint256);

    /// @notice Transfers WETH to a recipient.
    /// @param to Recipient address.
    /// @param value Amount to transfer.
    /// @return success True if the transfer succeeded.
    function transfer(address to, uint256 value) external returns (bool);

    /// @notice Unwraps WETH to ETH.
    /// @param value Amount to unwrap.
    function withdraw(uint256 value) external;
}

/// @title OwnerPayoutSplitter
/// @notice Splits ETH payouts by swapping 50% into PNKSTR and forwarding ETH + PNKSTR to owner.
/// @dev Uses PoolManager unlock + swap; swap failures fall back to owner.
/// @author cubixles_
contract OwnerPayoutSplitter is Ownable, ReentrancyGuard, IUnlockCallback {
    using BalanceDeltaLibrary for BalanceDelta;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    /// @notice PNKSTR token address.
    address public immutable PNKSTR_TOKEN; /* solhint-disable-line immutable-vars-naming */ /* slither-disable-line naming-convention */
    /// @notice Uniswap v4 PoolManager.
    IPoolManager public immutable POOL_MANAGER; /* solhint-disable-line immutable-vars-naming */ /* slither-disable-line naming-convention */
    /// @notice PoolKey for the ETH/PNKSTR pool.
    PoolKey public pnkPoolKey;
    /// @notice Whether swap to PNKSTR is enabled.
    bool public swapEnabled;
    /// @notice Max slippage in basis points (0 disables).
    uint16 public swapMaxSlippageBps;
    /// @notice Upper bound for slippage.
    uint16 public constant MAX_SWAP_SLIPPAGE_BPS = 1000;

    /// @notice PNKSTR token address is required.
    error PnkstrTokenRequired();
    /// @notice Owner is required.
    error OwnerRequired();
    /// @notice PoolManager is required when enabling swaps.
    error PoolManagerRequired();
    /// @notice PoolKey does not match expected pool.
    error InvalidPoolKey();
    /// @notice Slippage exceeds allowed maximum.
    error InvalidSlippageBps();
    /// @notice Pool is not initialized.
    error PoolNotInitialized();
    /// @notice Swap yielded no PNKSTR output.
    error SwapOutputTooLow();
    /// @notice PoolManager settle returned an unexpected amount.
    error SettleMismatch(uint256 expected, uint256 paid);
    /// @notice Only PoolManager can call unlockCallback.
    error PoolManagerOnly();
    /// @notice Recipient is required.
    error RecipientRequired();
    /// @notice WETH transfer failed.
    error WethTransferFailed();

    /// @notice Emitted when swap enabled toggles.
    /// @param enabled Whether swap is enabled.
    event SwapEnabledUpdated(bool indexed enabled);
    /// @notice Emitted when slippage config changes.
    /// @param maxSlippageBps Max slippage in bps.
    event SwapSlippageUpdated(uint16 indexed maxSlippageBps);
    /// @notice Emitted when swap fails and ETH is forwarded to owner.
    /// @param amount ETH amount forwarded.
    /// @param reasonHash Hash of the revert reason.
    event SwapFailedFallbackToOwner(uint256 indexed amount, bytes32 reasonHash);
    // solhint-disable gas-indexed-events
    /// @notice Emitted when WETH is swept from the splitter.
    /// @param weth WETH token address.
    /// @param recipient Recipient of the sweep.
    /// @param amount Amount swept.
    /// @param unwrapped Whether the sweep unwrapped WETH to ETH.
    event WethSwept(address indexed weth, address indexed recipient, uint256 amount, bool unwrapped);
    // solhint-enable gas-indexed-events

    /// @notice Create a new owner payout splitter.
    /// @param owner_ Owner who receives ETH and PNKSTR and can configure settings.
    /// @param pnkstrToken_ PNKSTR token address.
    /// @param poolManager_ Uniswap v4 PoolManager (optional for no-swap).
    /// @param pnkPoolKey_ PoolKey for ETH/PNKSTR pool.
    /// @param swapMaxSlippageBps_ Max slippage in basis points.
    constructor(
        address owner_,
        address pnkstrToken_,
        IPoolManager poolManager_,
        PoolKey memory pnkPoolKey_,
        uint16 swapMaxSlippageBps_
    ) Ownable(owner_) {
        if (owner_ == address(0)) {
            revert OwnerRequired();
        }
        bool swapReady = address(poolManager_) != address(0);
        if (swapReady) {
            if (pnkstrToken_ == address(0)) {
                revert PnkstrTokenRequired();
            }
            _requirePoolKeyMatches(pnkPoolKey_, pnkstrToken_);
        }
        if (swapMaxSlippageBps_ > MAX_SWAP_SLIPPAGE_BPS) {
            revert InvalidSlippageBps();
        }
        PNKSTR_TOKEN = pnkstrToken_;
        POOL_MANAGER = poolManager_;
        pnkPoolKey = pnkPoolKey_;
        swapEnabled = swapReady;
        swapMaxSlippageBps = swapMaxSlippageBps_;
    }

    /// @notice Accept ETH and process payout split.
    receive() external payable nonReentrant {
        _handlePayout();
    }

    /// @notice Fallback to handle ETH sent with calldata.
    fallback() external payable nonReentrant {
        _handlePayout();
    }

    /// @notice Toggle swap behavior.
    /// @param enabled Whether swap to PNKSTR is enabled.
    function setSwapEnabled(bool enabled) external onlyOwner {
        if (enabled && address(POOL_MANAGER) == address(0)) {
            revert PoolManagerRequired();
        }
        if (enabled && !_poolInitialized(pnkPoolKey)) {
            revert PoolNotInitialized();
        }
        swapEnabled = enabled;
        emit SwapEnabledUpdated(enabled);
    }

    /// @notice Configure max slippage in basis points.
    /// @param maxSlippageBps Max slippage in bps (0 disables).
    function setSwapMaxSlippageBps(uint16 maxSlippageBps) external onlyOwner {
        if (maxSlippageBps > MAX_SWAP_SLIPPAGE_BPS) {
            revert InvalidSlippageBps();
        }
        swapMaxSlippageBps = maxSlippageBps;
        emit SwapSlippageUpdated(maxSlippageBps);
    }

    /// @notice Sweep WETH sent to this contract.
    /// @param weth WETH token address.
    /// @param recipient Recipient of ETH or WETH.
    /// @param unwrap Whether to unwrap to ETH before sending.
    function sweepWeth(address weth, address recipient, bool unwrap) external onlyOwner nonReentrant {
        if (recipient == address(0)) {
            revert RecipientRequired();
        }
        uint256 amount = IWETH(weth).balanceOf(address(this));
        if (amount < 1) {
            return;
        }
        if (unwrap) {
            IWETH(weth).withdraw(amount);
            _send(recipient, amount);
        } else {
            if (!IWETH(weth).transfer(recipient, amount)) {
                revert WethTransferFailed();
            }
        }
        emit WethSwept(weth, recipient, amount, unwrap);
    }

    /// @dev Entry for ETH payout handling.
    function _handlePayout() internal {
        uint256 amount = msg.value;
        if (amount == 0) {
            return;
        }

        if (!swapEnabled || address(POOL_MANAGER) == address(0)) {
            _send(owner(), amount);
            return;
        }

        uint256 ethToSwap = amount / 2;
        uint256 ethToOwner = amount - ethToSwap;
        if (ethToOwner > 0) {
            _send(owner(), ethToOwner);
        }
        if (ethToSwap > 0) {
            _swapAndDistribute(ethToSwap);
        }
        _send(owner(), address(this).balance);
    }

    /// @notice PoolManager callback to perform swap settlement.
    /// @param data Encoded ETH amount input.
    /// @return Encoded balance delta.
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(POOL_MANAGER)) {
            revert PoolManagerOnly();
        }
        uint256 amountIn = abi.decode(data, (uint256));
        if (amountIn == 0) {
            return bytes("");
        }
        PoolKey memory key = pnkPoolKey;
        uint160 sqrtPriceLimitX96 = _sqrtPriceLimit(key);
        BalanceDelta delta = _swapForToken(key, amountIn, sqrtPriceLimitX96);
        _settleSwap(key, delta);

        return abi.encode(delta.amount0(), delta.amount1());
    }

    /// @dev Send ETH and revert on failure.
    function _send(address recipient, uint256 amount) internal {
        if (amount < 1) {
            return;
        }
        Address.sendValue(payable(recipient), amount);
    }

    // slither-disable-next-line reentrancy-events
    function _swapAndDistribute(uint256 ethToSwap) private {
        if (ethToSwap == 0) {
            return;
        }
        try POOL_MANAGER.unlock(abi.encode(ethToSwap)) returns (bytes memory unlockResult) {
            if (unlockResult.length == 64) {
                (, int128 amount1) = abi.decode(unlockResult, (int128, int128));
                if (amount1 < 1) {
                    emit SwapFailedFallbackToOwner(
                        ethToSwap,
                        keccak256(bytes("SwapOutputTooLow"))
                    );
                    _send(owner(), ethToSwap);
                    return;
                }
            }
        } catch (bytes memory reason) {
            emit SwapFailedFallbackToOwner(ethToSwap, keccak256(reason));
            _send(owner(), ethToSwap);
        }
    }

    /// @dev Compute sqrtPrice limit based on slippage bps.
    function _slippageLimit(uint160 sqrtPriceX96) internal view returns (uint160) {
        if (swapMaxSlippageBps == 0) {
            return sqrtPriceX96;
        }
        uint256 bps = swapMaxSlippageBps;
        uint256 limit = (uint256(sqrtPriceX96) * (10_000 - bps)) / 10_000;
        if (limit < TickMath.MIN_SQRT_PRICE + 1) {
            return TickMath.MIN_SQRT_PRICE + 1;
        }
        return SafeCast.toUint160(limit);
    }

    function _sqrtPriceLimit(PoolKey memory key) private view returns (uint160) {
        uint160 sqrtPriceLimitX96 = TickMath.MIN_SQRT_PRICE + 1;
        if (swapMaxSlippageBps != 0) {
            // slither-disable-next-line unused-return
            (uint160 sqrtPriceX96, , , ) = POOL_MANAGER.getSlot0(key.toId());
            sqrtPriceLimitX96 = _slippageLimit(sqrtPriceX96);
        }
        return sqrtPriceLimitX96;
    }

    function _swapForToken(
        PoolKey memory key,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) private returns (BalanceDelta) {
        return POOL_MANAGER.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -SafeCast.toInt256(amountIn),
                sqrtPriceLimitX96: sqrtPriceLimitX96
            }),
            bytes("")
        );
    }

    function _settleSwap(PoolKey memory key, BalanceDelta delta) private {
        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();
        if (amount1 < 1) {
            revert SwapOutputTooLow();
        }

        if (amount0 < 0) {
            int256 amount0Abs = -int256(amount0);
            uint256 amount0AbsU = SafeCast.toUint256(amount0Abs);
            uint256 paid = POOL_MANAGER.settle{ value: amount0AbsU }();
            if (paid != amount0AbsU) {
                revert SettleMismatch(amount0AbsU, paid);
            }
        }
        if (amount1 > 0) {
            int256 amount1Signed = int256(amount1);
            uint256 output = SafeCast.toUint256(amount1Signed);
            POOL_MANAGER.take(key.currency1, owner(), output);
        }
    }

    /// @dev Check that the pool has been initialized.
    function _poolInitialized(PoolKey memory key) internal view returns (bool) {
        if (address(POOL_MANAGER) == address(0)) {
            return false;
        }
        // slither-disable-next-line unused-return
        (uint160 sqrtPriceX96, , , ) = POOL_MANAGER.getSlot0(key.toId());
        return sqrtPriceX96 != 0;
    }

    function _requirePoolKeyMatches(PoolKey memory key, address token) private pure {
        if (Currency.unwrap(key.currency0) != address(0)) {
            revert InvalidPoolKey();
        }
        if (Currency.unwrap(key.currency1) != token) {
            revert InvalidPoolKey();
        }
    }
}
