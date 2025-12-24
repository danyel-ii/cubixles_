// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script } from "forge-std/Script.sol";
import { IceCubeMinter } from "../src/icecube/IceCubeMinter.sol";
import { RoyaltySplitter } from "../src/royalties/RoyaltySplitter.sol";

contract DeployIceCube is Script {
    function run() external {
        address owner = vm.envAddress("ICECUBE_OWNER");
        address lessToken = vm.envOr(
            "ICECUBE_LESS_TOKEN",
            address(0x9c2ca573009F181EAc634C4D6E44a0977c24f335)
        );
        address router = vm.envOr("ICECUBE_ROUTER", address(0));
        bytes memory swapCalldata = vm.envOr("ICECUBE_SWAP_CALLDATA", bytes(""));
        uint96 resaleRoyaltyBps = uint96(vm.envOr("ICECUBE_RESALE_BPS", uint256(500)));

        vm.startBroadcast();
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            lessToken,
            router,
            swapCalldata
        );
        IceCubeMinter minter = new IceCubeMinter(address(splitter), resaleRoyaltyBps);
        if (owner != msg.sender) {
            minter.transferOwnership(owner);
        }
        vm.stopBroadcast();

        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/contracts/deployments/sepolia.json");
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", 11155111);
        string memory json = vm.serializeAddress(obj, "address", address(minter));
        json = vm.serializeAddress(obj, "royaltySplitter", address(splitter));
        vm.writeJson(json, path);
    }
}
