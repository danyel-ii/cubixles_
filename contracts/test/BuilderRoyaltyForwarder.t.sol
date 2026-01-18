// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { BuilderRoyaltyForwarder } from "../src/royalties/BuilderRoyaltyForwarder.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";

contract ToggleReceiver {
    bool public revertOnReceive = true;

    receive() external payable {
        if (revertOnReceive) {
            revert("Receive reverted");
        }
    }

    function setRevert(bool value) external {
        revertOnReceive = value;
    }

    function withdrawPending(BuilderRoyaltyForwarder forwarder) external {
        forwarder.withdrawPending();
    }
}

contract BuilderRoyaltyForwarderTest is Test {
    address private owner = makeAddr("owner");
    address private payer = makeAddr("payer");

    function _deployForwarder() internal returns (BuilderRoyaltyForwarder forwarder) {
        forwarder = new BuilderRoyaltyForwarder();
        forwarder.initialize(owner);
    }

    function _sendValue(
        BuilderRoyaltyForwarder forwarder,
        uint256 amount,
        bytes memory data
    ) internal {
        vm.deal(payer, amount);
        vm.prank(payer);
        (bool success, ) = address(forwarder).call{ value: amount }(data);
        assertTrue(success);
    }

    function testInitializeGuards() public {
        BuilderRoyaltyForwarder forwarder = new BuilderRoyaltyForwarder();

        vm.expectRevert(BuilderRoyaltyForwarder.OwnerRequired.selector);
        forwarder.initialize(address(0));

        forwarder.initialize(owner);
        assertEq(forwarder.owner(), owner);

        vm.expectRevert(BuilderRoyaltyForwarder.AlreadyInitialized.selector);
        forwarder.initialize(owner);
    }

    function testSetSplitsValidations() public {
        BuilderRoyaltyForwarder forwarder = _deployForwarder();

        address[] memory recipients = new address[](1);
        uint16[] memory bps = new uint16[](2);
        recipients[0] = makeAddr("recipient");
        bps[0] = 100;
        bps[1] = 200;

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                BuilderRoyaltyForwarder.SplitLengthMismatch.selector,
                recipients.length,
                bps.length
            )
        );
        forwarder.setSplits(recipients, bps);

        recipients = new address[](1);
        bps = new uint16[](1);
        recipients[0] = address(0);
        bps[0] = 100;

        vm.prank(owner);
        vm.expectRevert(BuilderRoyaltyForwarder.SplitRecipientRequired.selector);
        forwarder.setSplits(recipients, bps);

        recipients[0] = makeAddr("recipient");
        bps[0] = forwarder.BPS() + 1;

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                BuilderRoyaltyForwarder.SplitBpsTooHigh.selector,
                uint256(bps[0])
            )
        );
        forwarder.setSplits(recipients, bps);
    }

    function testSetSplitsAndGetSplits() public {
        BuilderRoyaltyForwarder forwarder = _deployForwarder();
        address recipientA = makeAddr("recipientA");
        address recipientB = makeAddr("recipientB");
        address[] memory recipients = new address[](2);
        uint16[] memory bps = new uint16[](2);

        recipients[0] = recipientA;
        recipients[1] = recipientB;
        bps[0] = 2000;
        bps[1] = 3000;

        vm.prank(owner);
        forwarder.setSplits(recipients, bps);

        (address[] memory storedRecipients, uint16[] memory storedBps) =
            forwarder.getSplits();
        assertEq(storedRecipients.length, 2);
        assertEq(storedRecipients[0], recipientA);
        assertEq(storedRecipients[1], recipientB);
        assertEq(storedBps[0], 2000);
        assertEq(storedBps[1], 3000);
    }

    function testDistributeDefaultsToOwner() public {
        BuilderRoyaltyForwarder forwarder = _deployForwarder();
        vm.deal(owner, 0);

        _sendValue(forwarder, 1 ether, "");
        _sendValue(forwarder, 1 ether, hex"01");

        assertEq(owner.balance, 2 ether);
    }

    function testDistributeSplitsAndRemainder() public {
        BuilderRoyaltyForwarder forwarder = _deployForwarder();
        address recipientA = makeAddr("recipientA");
        address recipientB = makeAddr("recipientB");
        address[] memory recipients = new address[](2);
        uint16[] memory bps = new uint16[](2);

        recipients[0] = recipientA;
        recipients[1] = recipientB;
        bps[0] = 2000;
        bps[1] = 3000;

        vm.prank(owner);
        forwarder.setSplits(recipients, bps);

        vm.deal(owner, 0);
        vm.deal(recipientA, 0);
        vm.deal(recipientB, 0);

        _sendValue(forwarder, 10 ether, "");

        assertEq(recipientA.balance, 2 ether);
        assertEq(recipientB.balance, 3 ether);
        assertEq(owner.balance, 5 ether);
    }

    function testDistributeSkipsZeroShare() public {
        BuilderRoyaltyForwarder forwarder = _deployForwarder();
        address recipientA = makeAddr("recipientA");
        address recipientB = makeAddr("recipientB");
        address[] memory recipients = new address[](2);
        uint16[] memory bps = new uint16[](2);

        recipients[0] = recipientA;
        recipients[1] = recipientB;
        bps[0] = 1;
        bps[1] = 1000;

        vm.prank(owner);
        forwarder.setSplits(recipients, bps);

        vm.deal(owner, 0);
        vm.deal(recipientA, 0);
        vm.deal(recipientB, 0);

        _sendValue(forwarder, 100 wei, "");

        assertEq(recipientA.balance, 0);
        assertEq(recipientB.balance, 10);
        assertEq(owner.balance, 90);
    }

    function testWithdrawPendingPaths() public {
        BuilderRoyaltyForwarder forwarder = _deployForwarder();
        ToggleReceiver receiver = new ToggleReceiver();
        address[] memory recipients = new address[](1);
        uint16[] memory bps = new uint16[](1);

        recipients[0] = address(receiver);
        bps[0] = forwarder.BPS();

        vm.prank(owner);
        forwarder.setSplits(recipients, bps);

        _sendValue(forwarder, 1 ether, "");

        assertEq(forwarder.pending(address(receiver)), 1 ether);

        vm.expectRevert(BuilderRoyaltyForwarder.PendingWithdrawFailed.selector);
        receiver.withdrawPending(forwarder);
        assertEq(forwarder.pending(address(receiver)), 1 ether);

        receiver.setRevert(false);
        receiver.withdrawPending(forwarder);

        assertEq(forwarder.pending(address(receiver)), 0);
        assertEq(address(receiver).balance, 1 ether);
    }

    function testWithdrawPendingRevertsWhenEmpty() public {
        BuilderRoyaltyForwarder forwarder = _deployForwarder();

        vm.prank(owner);
        vm.expectRevert(BuilderRoyaltyForwarder.PendingBalanceEmpty.selector);
        forwarder.withdrawPending();
    }

    function testSweepTokenPaths() public {
        BuilderRoyaltyForwarder forwarder = _deployForwarder();
        MockERC20 token = new MockERC20("Mock", "MOCK");

        vm.prank(owner);
        vm.expectRevert(BuilderRoyaltyForwarder.SweepRecipientRequired.selector);
        forwarder.sweepToken(address(token), address(0));

        token.mint(address(forwarder), 100);
        vm.prank(owner);
        forwarder.sweepToken(address(token), owner);
        assertEq(token.balanceOf(owner), 100);

        vm.prank(owner);
        forwarder.sweepToken(address(token), owner);
    }

    function testZeroValueNoop() public {
        BuilderRoyaltyForwarder forwarder = _deployForwarder();

        vm.prank(payer);
        (bool success, ) = address(forwarder).call{ value: 0 }("");
        assertTrue(success);
    }
}
