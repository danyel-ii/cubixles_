// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { OwnerPayoutSplitter } from "../src/royalties/OwnerPayoutSplitter.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { IUnlockCallback } from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { BalanceDelta, toBalanceDelta } from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";

contract OwnerPayoutRevertingPoolManager {
    function unlock(bytes calldata) external pure returns (bytes memory) {
        revert("Swap failed");
    }
}

contract OwnerPayoutSilentRevertingPoolManager {
    function unlock(bytes calldata) external pure returns (bytes memory) {
        revert();
    }
}

contract OwnerPayoutLowOutputPoolManager {
    function unlock(bytes calldata) external pure returns (bytes memory) {
        return abi.encode(int128(0), int128(0));
    }
}

contract OwnerPayoutMockWETH is MockERC20 {
    bool public transferSucceeds = true;

    constructor() MockERC20("Wrapped ETH", "WETH") {}

    function setTransferSucceeds(bool value) external {
        transferSucceeds = value;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (!transferSucceeds) {
            return false;
        }
        return super.transfer(to, amount);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}

contract OwnerPayoutMockPoolManager {
    MockERC20 public immutable pnk;
    int128 public immutable amount1Out;
    bool public immutable initialized;
    uint256 public immutable settleReturn;
    bool public immutable useSettleReturn;
    uint160 public immutable sqrtPriceX96;

    constructor(
        MockERC20 pnk_,
        int128 amount1Out_,
        bool initialized_,
        uint256 settleReturn_,
        bool useSettleReturn_,
        uint160 sqrtPriceX96_
    ) {
        pnk = pnk_;
        amount1Out = amount1Out_;
        initialized = initialized_;
        settleReturn = settleReturn_;
        useSettleReturn = useSettleReturn_;
        sqrtPriceX96 = sqrtPriceX96_;
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
        if (useSettleReturn) {
            return settleReturn;
        }
        return msg.value;
    }

    function take(Currency currency, address to, uint256 amount) external {
        if (!currency.isAddressZero()) {
            address token = Currency.unwrap(currency);
            if (token == address(pnk)) {
                pnk.mint(to, amount);
            }
        }
    }

    function extsload(bytes32) external view returns (bytes32 value) {
        if (!initialized) {
            return bytes32(0);
        }
        return bytes32(uint256(sqrtPriceX96));
    }

    function extsload(bytes32, uint256) external view returns (bytes32[] memory values) {
        values = new bytes32[](1);
        values[0] = initialized ? bytes32(uint256(sqrtPriceX96)) : bytes32(0);
    }

    function extsload(bytes32[] calldata slots) external view returns (bytes32[] memory values) {
        values = new bytes32[](slots.length);
        bytes32 value = initialized ? bytes32(uint256(sqrtPriceX96)) : bytes32(0);
        for (uint256 i = 0; i < slots.length; i++) {
            values[i] = value;
        }
    }
}

contract OwnerPayoutSplitterHarness is OwnerPayoutSplitter {
    constructor(
        address owner_,
        address pnkstrToken_,
        IPoolManager poolManager_,
        PoolKey memory pnkPoolKey_,
        uint16 swapMaxSlippageBps_
    ) OwnerPayoutSplitter(owner_, pnkstrToken_, poolManager_, pnkPoolKey_, swapMaxSlippageBps_) {}

    function exposedSlippageLimit(uint160 sqrtPriceX96) external view returns (uint160) {
        return _slippageLimit(sqrtPriceX96);
    }

    function exposedPoolInitialized(PoolKey memory key) external view returns (bool) {
        return _poolInitialized(key);
    }
}

contract OwnerPayoutSplitterTest is Test {
    address private owner = makeAddr("owner");

    function setUp() public {
        vm.deal(owner, 0);
    }

    function _poolKey(address token) internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(token),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function testConstructorRevertsOnInvalidOwner() public {
        vm.expectRevert();
        new OwnerPayoutSplitter(
            address(0),
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );
    }

    function testConstructorRevertsOnZeroPnkWhenPoolManagerProvided() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(1),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );

        vm.expectRevert(OwnerPayoutSplitter.PnkstrTokenRequired.selector);
        new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(pool)),
            _poolKey(address(0)),
            0
        );
    }

    function testConstructorRevertsOnInvalidPoolKeyCurrency0() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        MockERC20 other = new MockERC20("OTHER", "OTR");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(1),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(other)),
            currency1: Currency.wrap(address(pnk)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.expectRevert(OwnerPayoutSplitter.InvalidPoolKey.selector);
        new OwnerPayoutSplitter(owner, address(pnk), IPoolManager(address(pool)), key, 0);
    }

    function testConstructorRevertsOnInvalidPoolKeyCurrency1() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        MockERC20 other = new MockERC20("OTHER", "OTR");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(1),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(other)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.expectRevert(OwnerPayoutSplitter.InvalidPoolKey.selector);
        new OwnerPayoutSplitter(owner, address(pnk), IPoolManager(address(pool)), key, 0);
    }

    function testConstructorRevertsOnInvalidSlippage() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(1),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );

        vm.expectRevert(OwnerPayoutSplitter.InvalidSlippageBps.selector);
        new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            1001
        );
    }

    function testForwardsAllWhenSwapDisabled() public {
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );
        vm.deal(address(this), 1 ether);

        (bool ok, ) = address(splitter).call{ value: 1 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testFallbackWithCalldataForwardsWhenSwapDisabled() public {
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );
        vm.deal(address(this), 1 ether);

        (bool ok, ) = address(splitter).call{ value: 1 ether }("0x1234");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testHandlePayoutNoopOnZeroValue() public {
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );

        (bool ok, ) = address(splitter).call("");
        assertTrue(ok);
        assertEq(owner.balance, 0);
    }

    function testSwapEnabledRequiresPoolManager() public {
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );

        vm.prank(owner);
        vm.expectRevert(OwnerPayoutSplitter.PoolManagerRequired.selector);
        splitter.setSwapEnabled(true);
    }

    function testSwapEnabledRevertsWhenPoolNotInitialized() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(1),
            false,
            0,
            false,
            0
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(owner);
        vm.expectRevert(OwnerPayoutSplitter.PoolNotInitialized.selector);
        splitter.setSwapEnabled(true);
    }

    function testSwapEnabledUpdatesWhenInitialized() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(1),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(owner);
        splitter.setSwapEnabled(false);
        assertFalse(splitter.swapEnabled());

        vm.prank(owner);
        splitter.setSwapEnabled(true);
        assertTrue(splitter.swapEnabled());
    }

    function testSetSwapMaxSlippageRevertsOnInvalidValue() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(1),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(owner);
        vm.expectRevert(OwnerPayoutSplitter.InvalidSlippageBps.selector);
        splitter.setSwapMaxSlippageBps(1001);
    }

    function testSetSwapMaxSlippageUpdates() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(1),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(owner);
        splitter.setSwapMaxSlippageBps(50);
        assertEq(splitter.swapMaxSlippageBps(), 50);
    }

    function testSwapSkipsWhenAmountTooSmall() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(10),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 1);
        (bool ok, ) = address(splitter).call{ value: 1 }("");
        assertTrue(ok);
        assertEq(owner.balance, 1);
    }

    function testSwapSuccessForwardsEthAndPnk() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(25),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            50
        );

        vm.deal(address(this), 1 ether);
        (bool ok, ) = address(splitter).call{ value: 1 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 0.5 ether);
        assertEq(pnk.balanceOf(owner), uint256(uint128(25)));
    }

    function testSwapLowOutputFallsBackToOwner() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutLowOutputPoolManager pool = new OwnerPayoutLowOutputPoolManager();
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 1 ether);
        (bool ok, ) = address(splitter).call{ value: 1 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testSwapRevertFallsBackToOwner() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutRevertingPoolManager pool = new OwnerPayoutRevertingPoolManager();
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 1 ether);
        (bool ok, ) = address(splitter).call{ value: 1 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testSwapSilentRevertFallsBackToOwner() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutSilentRevertingPoolManager pool = new OwnerPayoutSilentRevertingPoolManager();
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(this), 1 ether);
        (bool ok, ) = address(splitter).call{ value: 1 ether }("");
        assertTrue(ok);
        assertEq(owner.balance, 1 ether);
    }

    function testUnlockCallbackRevertsWhenNotPoolManager() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(10),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.expectRevert(OwnerPayoutSplitter.PoolManagerOnly.selector);
        splitter.unlockCallback(abi.encode(uint256(1 ether)));
    }

    function testUnlockCallbackReturnsEmptyWhenZeroAmount() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(10),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.prank(address(pool));
        bytes memory result = splitter.unlockCallback(abi.encode(uint256(0)));
        assertEq(result.length, 0);
    }

    function testUnlockCallbackRevertsOnSwapOutputTooLow() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(0),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(splitter), 1 ether);
        vm.prank(address(pool));
        vm.expectRevert(OwnerPayoutSplitter.SwapOutputTooLow.selector);
        splitter.unlockCallback(abi.encode(uint256(1 ether)));
    }

    function testUnlockCallbackRevertsOnSettleMismatch() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(10),
            true,
            1,
            true,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        vm.deal(address(splitter), 1 ether);
        vm.prank(address(pool));
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnerPayoutSplitter.SettleMismatch.selector,
                1 ether,
                1
            )
        );
        splitter.unlockCallback(abi.encode(uint256(1 ether)));
    }

    function testPoolInitializedForZeroManagerIsFalse() public {
        OwnerPayoutSplitterHarness splitter = new OwnerPayoutSplitterHarness(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );

        assertFalse(splitter.exposedPoolInitialized(_poolKey(address(0))));
    }

    function testPoolInitializedReturnsTrueWhenSlot0NonZero() public {
        MockERC20 pnk = new MockERC20("PNKSTR", "PNK");
        OwnerPayoutMockPoolManager pool = new OwnerPayoutMockPoolManager(
            pnk,
            int128(1),
            true,
            0,
            false,
            TickMath.MIN_SQRT_PRICE + 10
        );
        OwnerPayoutSplitterHarness splitter = new OwnerPayoutSplitterHarness(
            owner,
            address(pnk),
            IPoolManager(address(pool)),
            _poolKey(address(pnk)),
            0
        );

        assertTrue(splitter.exposedPoolInitialized(_poolKey(address(pnk))));
    }

    function testSlippageLimitReturnsInputWhenDisabled() public {
        OwnerPayoutSplitterHarness splitter = new OwnerPayoutSplitterHarness(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );

        assertEq(splitter.exposedSlippageLimit(123), 123);
    }

    function testSlippageLimitClampsToMin() public {
        OwnerPayoutSplitterHarness splitter = new OwnerPayoutSplitterHarness(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            500
        );

        assertEq(
            splitter.exposedSlippageLimit(1),
            TickMath.MIN_SQRT_PRICE + 1
        );
    }

    function testSlippageLimitReturnsReducedValue() public {
        OwnerPayoutSplitterHarness splitter = new OwnerPayoutSplitterHarness(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            500
        );

        uint160 price = type(uint160).max;
        uint160 limit = splitter.exposedSlippageLimit(price);
        assertTrue(limit < price);
        assertTrue(limit >= TickMath.MIN_SQRT_PRICE + 1);
    }

    function testSweepWethRevertsOnZeroRecipient() public {
        OwnerPayoutMockWETH weth = new OwnerPayoutMockWETH();
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );

        vm.prank(owner);
        vm.expectRevert(OwnerPayoutSplitter.RecipientRequired.selector);
        splitter.sweepWeth(address(weth), address(0), false);
    }

    function testSweepWethNoopWhenEmpty() public {
        OwnerPayoutMockWETH weth = new OwnerPayoutMockWETH();
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );

        vm.prank(owner);
        splitter.sweepWeth(address(weth), owner, false);
        assertEq(weth.balanceOf(owner), 0);
    }

    function testSweepWethUnwrapsToEth() public {
        OwnerPayoutMockWETH weth = new OwnerPayoutMockWETH();
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );

        uint256 amount = 1 ether;
        weth.mint(address(splitter), amount);
        vm.deal(address(splitter), amount);

        vm.prank(owner);
        splitter.sweepWeth(address(weth), owner, true);

        assertEq(weth.balanceOf(address(splitter)), 0);
        assertEq(owner.balance, amount);
    }

    function testSweepWethTransfersToken() public {
        OwnerPayoutMockWETH weth = new OwnerPayoutMockWETH();
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );

        uint256 amount = 2 ether;
        weth.mint(address(splitter), amount);

        vm.prank(owner);
        splitter.sweepWeth(address(weth), owner, false);

        assertEq(weth.balanceOf(owner), amount);
    }

    function testSweepWethRevertsOnTransferFailure() public {
        OwnerPayoutMockWETH weth = new OwnerPayoutMockWETH();
        OwnerPayoutSplitter splitter = new OwnerPayoutSplitter(
            owner,
            address(0),
            IPoolManager(address(0)),
            _poolKey(address(0)),
            0
        );

        weth.mint(address(splitter), 1 ether);
        weth.setTransferSucceeds(false);

        vm.prank(owner);
        vm.expectRevert(OwnerPayoutSplitter.WethTransferFailed.selector);
        splitter.sweepWeth(address(weth), owner, false);
    }
}
