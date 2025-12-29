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

    constructor(MockLess less_, int128 amount1Out_, bool initialized_) {
        less = less_;
        amount1Out = amount1Out_;
        initialized = initialized_;
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

    function settle() external payable returns (uint256) {
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
        MockPoolManager poolManager = new MockPoolManager(less, 0, true);
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
        MockPoolManager poolManager = new MockPoolManager(less, 0, true);
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
            2 ether,
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
        emit SwapFailedFallbackToOwner(2 ether, keccak256(""));
        (bool ok, ) = address(splitter).call{ value: 2 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 2 ether);
    }

    function testForwardsLessAndEthOnSwapSuccess() public {
        MockLess less = new MockLess();
        MockPoolManager poolManager = new MockPoolManager(less, 250 ether, true);
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
        assertEq(less.balanceOf(owner), 125 ether);
        assertEq(less.balanceOf(burn), 125 ether);
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
        vm.expectRevert(
            abi.encodeWithSelector(RoyaltySplitter.EthTransferFailed.selector, address(receiver), 1 ether)
        );
        address(splitter).call{ value: 1 ether }("");
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
        MockPoolManager poolManager = new MockPoolManager(less, 0, true);
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
        MockPoolManager poolManager = new MockPoolManager(less, 0, false);
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
        MockPoolManager poolManager = new MockPoolManager(less, 0, true);
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
}
