// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script } from "forge-std/Script.sol";
import { CubixlesMinter } from "../src/cubixles/CubixlesMinter.sol";
import { MintBlocker } from "../src/maintenance/MintBlocker.sol";

/// @notice Deploys a MintBlocker and points an existing minter at it to block mints.
contract DisableLegacyMinter is Script {
    function run() external {
        address legacyMinter = vm.envAddress("CUBIXLES_LEGACY_MINTER");
        address existingBlocker = vm.envOr("CUBIXLES_MINT_BLOCKER", address(0));
        vm.startBroadcast();

        MintBlocker blocker = existingBlocker == address(0)
            ? new MintBlocker()
            : MintBlocker(existingBlocker);

        CubixlesMinter minter = CubixlesMinter(legacyMinter);
        if (minter.resaleSplitter() != address(blocker)) {
            minter.setRoyaltyReceiver(address(blocker));
        }
        vm.stopBroadcast();
    }
}
