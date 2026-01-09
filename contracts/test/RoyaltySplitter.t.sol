// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { RoyaltySplitter } from "../src/royalties/RoyaltySplitter.sol";
import { ReceiverRevertsOnReceive } from "./mocks/Receivers.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { IUnlockCallback } from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { BalanceDelta, toBalanceDelta } from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";

contract RevertingPoolManager {
    function unlock(bytes calldata) external pure returns (bytes memory) {
        revert("Swap failed");
    }
}

contract SilentRevertingPoolManager {
    function unlock(bytes calldata) external pure returns (bytes memory) {
        revert();
    }
}

contract LowOutputPoolManager {
    function unlock(bytes calldata) external pure returns (bytes memory) {
        return abi.encode(int128(0), int128(0));
    }
}

contract MockToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPoolManager {
    MockToken public immutable less;
    MockToken public immutable pnk;
    int128 public immutable amount1OutLess;
    int128 public immutable amount1OutPnk;
    bool public immutable initialized;
    uint256 public immutable settleReturn;
    bool public immutable useSettleReturn;
    uint160 public immutable sqrtPriceX96;
    int24 public immutable tick;
    uint24 public immutable protocolFee;
    uint24 public immutable lpFee;

    constructor(
        MockToken less_,
        MockToken pnk_,
        int128 amount1OutLess_,
        int128 amount1OutPnk_,
        bool initialized_,
        uint256 settleReturn_,
        bool useSettleReturn_
    ) {
        less = less_;
        pnk = pnk_;
        amount1OutLess = amount1OutLess_;
        amount1OutPnk = amount1OutPnk_;
        initialized = initialized_;
        settleReturn = settleReturn_;
        useSettleReturn = useSettleReturn_;
        sqrtPriceX96 = 2;
        tick = 0;
        protocolFee = 0;
        lpFee = 0;
    }

    function unlock(bytes calldata data) external returns (bytes memory) {
        return IUnlockCallback(msg.sender).unlockCallback(data);
    }

    function swap(PoolKey memory poolKey, IPoolManager.SwapParams memory params, bytes calldata)
        external
        view
        returns (BalanceDelta)
    {
        int128 amount0 = int128(params.amountSpecified);
        address outToken = Currency.unwrap(poolKey.currency1);
        int128 amount1 = outToken == address(less)
            ? amount1OutLess
            : outToken == address(pnk)
                ? amount1OutPnk
                : int128(0);
        return toBalanceDelta(amount0, amount1);
    }

    function getSlot0(bytes32) external view returns (uint160, int24, uint24, uint24) {
        return (sqrtPriceX96, tick, protocolFee, lpFee);
    }

    function settle() external payable returns (uint256) {
        if (useSettleReturn) {
            return settleReturn;
        }
        return msg.value;
    }

    function take(Currency currency, address to, uint256 amount) external {
        if (!currency.isAddressZero()) {
            address token = Currency.unwrap(currency);
            if (token == address(less)) {
                less.mint(to, amount);
            } else if (token == address(pnk)) {
                pnk.mint(to, amount);
            }
        }
    }

    function extsload(bytes32) external view returns (bytes32 value) {
        if (!initialized) {
            return bytes32(0);
        }
        return bytes32(uint256(1));
    }

    function extsload(bytes32, uint256) external view returns (bytes32[] memory values) {
        values = new bytes32[](1);
        values[0] = initialized ? bytes32(uint256(1)) : bytes32(0);
    }

    function extsload(bytes32[] calldata slots) external view returns (bytes32[] memory values) {
        values = new bytes32[](slots.length);
        bytes32 value = initialized ? bytes32(uint256(1)) : bytes32(0);
        for (uint256 i = 0; i < slots.length; i++) {
            values[i] = value;
        }
    }
}

contract RoyaltySplitterHarness is RoyaltySplitter {
    constructor(
        address owner_,
        address lessToken_,
        address pnkstrToken_,
        IPoolManager poolManager_,
        PoolKey memory lessPoolKey_,
        PoolKey memory pnkPoolKey_,
        uint16 swapMaxSlippageBps_
    )
        RoyaltySplitter(
            owner_,
            lessToken_,
            pnkstrToken_,
            poolManager_,
            lessPoolKey_,
            pnkPoolKey_,
            swapMaxSlippageBps_
        )
    {}

    function exposedSlippageLimit(uint160 sqrtPriceX96) external view returns (uint160) {
        return _slippageLimit(sqrtPriceX96);
    }

    function exposedPoolInitialized(PoolKey memory key) external view returns (bool) {
        return _poolInitialized(key);
    }
}

contract RoyaltySplitterTest is Test {
    address private owner = makeAddr("owner");

    function setUp() public {
        vm.deal(owner, 0);
    }
    event SwapEnabledUpdated(bool enabled);
    event SwapSlippageUpdated(uint16 maxSlippageBps);
    event SwapFailedFallbackToOwner(uint256 amount, bytes32 reasonHash);

    function _poolKey(address token) internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function testForwardsAllWhenSwapDisabled() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );
        vm.deal(address(this), 1 ether);

        (bool ok, ) = address(splitter).call{ value: 1 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testFallbackWithCalldataForwardsWhenSwapDisabled() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );
        vm.deal(address(this), 1 ether);

        (bool ok, ) = address(splitter).call{ value: 1 ether }(hex"1234");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testSetSwapEnabledUpdatesStateAndEmits() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(owner);
        splitter.setSwapEnabled(false);
        assertEq(splitter.swapEnabled(), false);
    }

    function testForwardLessSkipsWhenBalanceZero() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 2 ether);
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(less.balanceOf(owner), 0);
        assertEq(pnk.balanceOf(owner), 0);
    }

    function testForwardsAllWhenSwapReverts() public {
        RevertingPoolManager poolManager = new RevertingPoolManager();
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 2 ether);
        address(splitter).call{ value: 2 ether }("");
        assertEq(owner.balance, 2 ether);
    }

    function testForwardsAllWhenSwapRevertsWithoutReason() public {
        SilentRevertingPoolManager poolManager = new SilentRevertingPoolManager();
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 2 ether);
        address(splitter).call{ value: 2 ether }("");
        assertEq(owner.balance, 2 ether);
    }

    function testForwardsLessAndEthOnSwapSuccess() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(
            less,
            pnk,
            250 ether,
            500 ether,
            true,
            0,
            false
        );
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 2 ether);
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 0.5 ether);
        assertEq(less.balanceOf(owner), 250 ether);
        assertEq(pnk.balanceOf(owner), 500 ether);
    }

    function testRevertsWhenOwnerCannotReceiveEth() public {
        ReceiverRevertsOnReceive receiver = new ReceiverRevertsOnReceive();
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitter splitter = new RoyaltySplitter(
            address(receiver),
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 1 ether);
        vm.expectRevert();
        address(splitter).call{ value: 1 ether }("");
    }

    function testSwapOutputTooLowFallsBackToOwner() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 2 ether);
        address(splitter).call{ value: 2 ether }("");
        assertEq(owner.balance, 2 ether);
    }

    function testSwapOutputTooLowFromUnlockResultFallsBack() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        LowOutputPoolManager poolManager = new LowOutputPoolManager();
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 1 ether);
        (bool ok, ) = address(splitter).call{ value: 1 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testSettleMismatchFallsBackToOwner() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 250 ether, 500 ether, true, 1, true);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 2 ether);
        address(splitter).call{ value: 2 ether }("");
        assertEq(owner.balance, 2 ether);
    }

    function testConstructorRevertsOnZeroLessToken() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, true, 0, false);
        vm.expectRevert(RoyaltySplitter.LessTokenRequired.selector);
        new RoyaltySplitter(
            owner,
            address(0),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(0)),
            _poolKey(address(pnk)),
            0
        );
    }

    function testConstructorRevertsOnZeroPnkToken() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, true, 0, false);
        vm.expectRevert(RoyaltySplitter.PnkstrTokenRequired.selector);
        new RoyaltySplitter(
            owner,
            address(less),
            address(0),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(0)),
            0
        );
    }

    function testConstructorRevertsOnZeroOwner() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        vm.expectRevert(abi.encodeWithSignature("OwnableInvalidOwner(address)", address(0)));
        new RoyaltySplitter(
            address(0),
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );
    }

    function testConstructorRevertsOnInvalidSlippage() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        vm.expectRevert(RoyaltySplitter.InvalidSlippageBps.selector);
        new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            type(uint16).max
        );
    }

    function testSetSwapEnabledRevertsWhenNoPoolManager() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(owner);
        vm.expectRevert(RoyaltySplitter.PoolManagerRequired.selector);
        splitter.setSwapEnabled(true);
    }

    function testNoOpWhenZeroValueReceived() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        (bool ok, ) = address(splitter).call("");
        assertTrue(ok);
        assertEq(owner.balance, 0);
    }

    function testSetSwapMaxSlippageUpdatesStateAndEmits() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(owner);
        splitter.setSwapMaxSlippageBps(250);

        assertEq(splitter.swapMaxSlippageBps(), 250);
    }

    function testSetSwapEnabledRevertsWhenPoolUninitialized() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, false, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(owner);
        vm.expectRevert(RoyaltySplitter.PoolNotInitialized.selector);
        splitter.setSwapEnabled(true);
    }

    function testSetSwapMaxSlippageRevertsWhenTooHigh() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(owner);
        vm.expectRevert(RoyaltySplitter.InvalidSlippageBps.selector);
        splitter.setSwapMaxSlippageBps(type(uint16).max);
    }

    function testConstructorRevertsOnInvalidCurrency0() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, true, 0, false);
        PoolKey memory badKey = PoolKey({
            currency0: Currency.wrap(address(less)),
            currency1: Currency.wrap(address(less)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.expectRevert(RoyaltySplitter.InvalidPoolKey.selector);
        new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            badKey,
            _poolKey(address(pnk)),
            0
        );
    }

    function testConstructorRevertsOnInvalidCurrency1() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 0, 0, true, 0, false);
        PoolKey memory badKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(0xBEEF)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.expectRevert(RoyaltySplitter.InvalidPoolKey.selector);
        new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            badKey,
            0
        );
    }

    function testConstructorAllowsZeroLessTokenWhenSwapDisabled() public {
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(0),
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            _poolKey(address(0)),
            0
        );
        assertEq(address(splitter.LESS_TOKEN()), address(0));
        assertEq(address(splitter.PNKSTR_TOKEN()), address(0));
        assertEq(address(splitter.POOL_MANAGER()), address(0));
    }

    function testSlippageLimitReturnsInputWhenZeroBps() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitterHarness splitter = new RoyaltySplitterHarness(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        uint160 sqrtPrice = 1_000_000;
        assertEq(splitter.exposedSlippageLimit(sqrtPrice), sqrtPrice);
    }

    function testSlippageLimitAppliesBps() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitterHarness splitter = new RoyaltySplitterHarness(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            50
        );

        uint160 sqrtPrice = TickMath.MIN_SQRT_PRICE + 1_000_000_000;
        uint160 limited = splitter.exposedSlippageLimit(sqrtPrice);
        assertTrue(limited < sqrtPrice);
    }

    function testPoolInitializedReturnsFalseWhenNoManager() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        RoyaltySplitterHarness splitter = new RoyaltySplitterHarness(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        assertEq(splitter.exposedPoolInitialized(_poolKey(address(less))), false);
    }

    function testUnlockCallbackRevertsWhenCallerNotPoolManager() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 250 ether, 500 ether, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.expectRevert(RoyaltySplitter.PoolManagerOnly.selector);
        splitter.unlockCallback(abi.encode(uint256(1), RoyaltySplitter.SwapToken.Less));
    }

    function testUnlockCallbackReturnsEmptyWhenAmountInZero() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 250 ether, 500 ether, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(address(poolManager));
        bytes memory result = splitter.unlockCallback(
            abi.encode(uint256(0), RoyaltySplitter.SwapToken.Less)
        );
        assertEq(result.length, 0);
    }

    function testUnlockCallbackWithSlippageConfig() public {
        MockToken less = new MockToken("LESS", "LESS");
        MockToken pnk = new MockToken("PNKSTR", "PNK");
        MockPoolManager poolManager = new MockPoolManager(less, pnk, 250 ether, 500 ether, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            address(pnk),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            _poolKey(address(pnk)),
            50
        );

        vm.deal(address(splitter), 1 ether);
        vm.prank(address(poolManager));
        bytes memory result = splitter.unlockCallback(
            abi.encode(uint256(1 ether), RoyaltySplitter.SwapToken.Less)
        );
        (int128 amount0, int128 amount1) = abi.decode(result, (int128, int128));
        assertTrue(amount0 < 0);
        assertTrue(amount1 > 0);
    }
}
