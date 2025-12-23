// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script } from "forge-std/Script.sol";
import { IceCubeMinter } from "../src/IceCubeMinter.sol";

contract DeployIceCube is Script {
    function run() external {
        address creator = vm.envAddress("ICECUBE_CREATOR");
        address lessTreasury = vm.envAddress("ICECUBE_LESS_TREASURY");
        address pnkstrTreasury = vm.envAddress("ICECUBE_PNKSTR_TREASURY");
        address poolTreasury = vm.envAddress("ICECUBE_POOL_TREASURY");
        uint96 resaleRoyaltyBps = uint96(vm.envOr("ICECUBE_RESALE_BPS", uint256(500)));

        vm.startBroadcast();
        IceCubeMinter minter = new IceCubeMinter(
            creator,
            lessTreasury,
            pnkstrTreasury,
            poolTreasury,
            resaleRoyaltyBps
        );
        vm.stopBroadcast();

        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/contracts/deployments/sepolia.json");
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", 11155111);
        string memory json = vm.serializeAddress(obj, "address", address(minter));
        vm.writeJson(json, path);
    }
}
