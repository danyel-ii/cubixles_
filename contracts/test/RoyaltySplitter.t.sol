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

contract MockLess is ERC20 {
    constructor() ERC20("LESS", "LESS") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPoolManager {
    MockLess public immutable less;
    int128 public immutable amount1Out;
    bool public immutable initialized;
    uint256 public immutable settleReturn;
    bool public immutable useSettleReturn;
    uint160 public immutable sqrtPriceX96;
    int24 public immutable tick;
    uint24 public immutable protocolFee;
    uint24 public immutable lpFee;

    constructor(
        MockLess less_,
        int128 amount1Out_,
        bool initialized_,
        uint256 settleReturn_,
        bool useSettleReturn_
    ) {
        less = less_;
        amount1Out = amount1Out_;
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

    function swap(PoolKey memory, IPoolManager.SwapParams memory params, bytes calldata)
        external
        view
        returns (BalanceDelta)
    {
        int128 amount0 = int128(params.amountSpecified);
        return toBalanceDelta(amount0, amount1Out);
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
            less.mint(to, amount);
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

contract RoyaltySplitterTest is Test {
    address private owner = makeAddr("owner");
    address private burn = address(0x000000000000000000000000000000000000dEaD);
    event SwapEnabledUpdated(bool enabled);
    event SwapSlippageUpdated(uint16 maxSlippageBps);
    event SwapFailedFallbackToOwner(uint256 amount, bytes32 reasonHash);

    function _poolKey(address less) internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(less),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function testForwardsAllWhenSwapDisabled() public {
        MockLess less = new MockLess();
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            0,
            burn
        );
        vm.deal(address(this), 1 ether);

        (bool ok, ) = address(splitter).call{ value: 1 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testFallbackWithCalldataForwardsWhenSwapDisabled() public {
        MockLess less = new MockLess();
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            0,
            burn
        );
        vm.deal(address(this), 1 ether);

        (bool ok, ) = address(splitter).call{ value: 1 ether }(hex"1234");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testSetSwapEnabledUpdatesStateAndEmits() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit SwapEnabledUpdated(false);
        splitter.setSwapEnabled(false);
        assertEq(splitter.swapEnabled(), false);
    }

    function testForwardLessSkipsWhenBalanceZero() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.deal(address(this), 2 ether);
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(less.balanceOf(owner), 0);
        assertEq(less.balanceOf(burn), 0);
    }

    function testForwardsAllWhenSwapReverts() public {
        RevertingPoolManager poolManager = new RevertingPoolManager();
        MockLess less = new MockLess();
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.deal(address(this), 2 ether);
        vm.expectEmit(false, false, false, true);
        emit SwapFailedFallbackToOwner(
            1 ether,
            keccak256(abi.encodeWithSignature("Error(string)", "Swap failed"))
        );
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 2 ether);
    }

    function testForwardsAllWhenSwapRevertsWithoutReason() public {
        SilentRevertingPoolManager poolManager = new SilentRevertingPoolManager();
        MockLess less = new MockLess();
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.deal(address(this), 2 ether);
        vm.expectEmit(false, false, false, true);
        emit SwapFailedFallbackToOwner(
            1 ether,
            keccak256("")
        );
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 2 ether);
    }

    function testForwardsLessAndEthOnSwapSuccess() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 250 ether, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.deal(address(this), 2 ether);
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
        assertEq(less.balanceOf(owner), 225 ether);
        assertEq(less.balanceOf(burn), 25 ether);
    }

    function testRevertsWhenOwnerCannotReceiveEth() public {
        ReceiverRevertsOnReceive receiver = new ReceiverRevertsOnReceive();
        MockLess less = new MockLess();
        RoyaltySplitter splitter = new RoyaltySplitter(
            address(receiver),
            address(less),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.deal(address(this), 1 ether);
        vm.expectRevert();
        address(splitter).call{ value: 1 ether }("");
    }

    function testSwapOutputTooLowFallsBackToOwner() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.deal(address(this), 2 ether);
        vm.expectEmit(false, false, false, true);
        emit SwapFailedFallbackToOwner(
            1 ether,
            keccak256(abi.encodeWithSelector(RoyaltySplitter.SwapOutputTooLow.selector))
        );
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 2 ether);
    }

    function testSettleMismatchFallsBackToOwner() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 250 ether, true, 1, true);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.deal(address(this), 2 ether);
        vm.expectEmit(false, false, false, true);
        emit SwapFailedFallbackToOwner(
            1 ether,
            keccak256(
                abi.encodeWithSelector(
                    RoyaltySplitter.SettleMismatch.selector,
                    1 ether,
                    uint256(1)
                )
            )
        );
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 2 ether);
    }

    function testConstructorRevertsOnZeroLessToken() public {
        vm.expectRevert(RoyaltySplitter.LessTokenRequired.selector);
        new RoyaltySplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0xBEEF)),
            0,
            burn
        );
    }

    function testSetSwapEnabledRevertsWhenNoPoolManager() public {
        MockLess less = new MockLess();
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(0)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.prank(owner);
        vm.expectRevert(RoyaltySplitter.PoolManagerRequired.selector);
        splitter.setSwapEnabled(true);
    }

    function testSetSwapMaxSlippageUpdatesStateAndEmits() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit SwapSlippageUpdated(250);
        splitter.setSwapMaxSlippageBps(250);

        assertEq(splitter.swapMaxSlippageBps(), 250);
    }

    function testSetSwapEnabledRevertsWhenPoolUninitialized() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 0, false, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.prank(owner);
        vm.expectRevert(RoyaltySplitter.PoolNotInitialized.selector);
        splitter.setSwapEnabled(true);
    }

    function testSetSwapMaxSlippageRevertsWhenTooHigh() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 0, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.prank(owner);
        vm.expectRevert(RoyaltySplitter.InvalidSlippageBps.selector);
        splitter.setSwapMaxSlippageBps(type(uint16).max);
    }

    function testConstructorRevertsOnInvalidCurrency0() public {
        MockLess less = new MockLess();
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
            IPoolManager(address(0)),
            badKey,
            0,
            burn
        );
    }

    function testConstructorRevertsOnInvalidCurrency1() public {
        MockLess less = new MockLess();
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
            IPoolManager(address(0)),
            badKey,
            0,
            burn
        );
    }

    function testUnlockCallbackRevertsWhenCallerNotPoolManager() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 250 ether, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.expectRevert(RoyaltySplitter.PoolManagerOnly.selector);
        splitter.unlockCallback(abi.encode(uint256(1)));
    }

    function testUnlockCallbackReturnsEmptyWhenAmountInZero() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 250 ether, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            0,
            burn
        );

        vm.prank(address(poolManager));
        bytes memory result = splitter.unlockCallback(abi.encode(uint256(0)));
        assertEq(result.length, 0);
    }

    function testUnlockCallbackWithSlippageConfig() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 250 ether, true, 0, false);
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            address(less),
            IPoolManager(address(poolManager)),
            _poolKey(address(less)),
            50,
            burn
        );

        vm.deal(address(splitter), 1 ether);
        vm.prank(address(poolManager));
        bytes memory result = splitter.unlockCallback(abi.encode(uint256(1 ether)));
        (int128 amount0, int128 amount1) = abi.decode(result, (int128, int128));
        assertTrue(amount0 < 0);
        assertTrue(amount1 > 0);
    }
}
