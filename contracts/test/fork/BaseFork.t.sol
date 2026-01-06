// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
contract BaseForkTest is Test {
    bool private forkReady;
    uint256 private forkBlock;
    uint256 private expectedChainId;
    address private forkTarget;

    uint256 private constant DEFAULT_FORK_BLOCK = 30_919_316;
    uint256 private constant DEFAULT_CHAIN_ID = 8_453;

    function setUp() public {
        string memory url = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            emit log("BASE_RPC_URL not set; skipping fork tests.");
            return;
        }
        forkBlock = vm.envOr("BASE_FORK_BLOCK", DEFAULT_FORK_BLOCK);
        expectedChainId = vm.envOr("BASE_FORK_CHAIN_ID", DEFAULT_CHAIN_ID);
        forkTarget = vm.envOr("BASE_FORK_TEST_ADDRESS", address(0));
        vm.createSelectFork(url, forkBlock);
        forkReady = true;
    }

    function testForkConnectivity() public view {
        if (!forkReady) {
            return;
        }
        assertEq(block.chainid, expectedChainId, "unexpected chain id");
        assertEq(block.number, forkBlock, "unexpected fork block");
        if (forkTarget != address(0)) {
            assertGt(forkTarget.code.length, 0, "BASE_FORK_TEST_ADDRESS has no code");
        }
    }
}
