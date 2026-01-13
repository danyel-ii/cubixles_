// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script } from "forge-std/Script.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { CubixlesMinter } from "../src/cubixles/CubixlesMinter.sol";
import { RoyaltySplitter } from "../src/royalties/RoyaltySplitter.sol";

contract DeployTimelock is Script {
    function run() external {
        TimelockConfig memory cfg = _loadConfig();
        address[] memory proposers = new address[](1);
        proposers[0] = cfg.proposer;
        address[] memory executors = new address[](1);
        executors[0] = cfg.executor;

        vm.startBroadcast();
        TimelockController timelock = new TimelockController(
            cfg.minDelay,
            proposers,
            executors,
            cfg.admin
        );
        CubixlesMinter(cfg.minter).transferOwnership(address(timelock));
        RoyaltySplitter(payable(cfg.splitter)).transferOwnership(address(timelock));
        vm.stopBroadcast();

        string memory root = vm.projectRoot();
        string memory path = vm.envOr(
            "CUBIXLES_TIMELOCK_DEPLOYMENT_PATH",
            string.concat(root, "/deployments/timelock.json")
        );
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", cfg.chainId);
        string memory json = vm.serializeAddress(obj, "address", address(timelock));
        json = vm.serializeAddress(obj, "minter", cfg.minter);
        json = vm.serializeAddress(obj, "royaltySplitter", cfg.splitter);
        vm.writeJson(json, path);
    }

    struct TimelockConfig {
        uint256 chainId;
        uint256 minDelay;
        address admin;
        address proposer;
        address executor;
        address minter;
        address splitter;
    }

    function _loadConfig() internal view returns (TimelockConfig memory cfg) {
        cfg.chainId = vm.envOr("CUBIXLES_CHAIN_ID", block.chainid);
        address owner = vm.envAddress("CUBIXLES_OWNER");
        cfg.minDelay = vm.envOr("CUBIXLES_TIMELOCK_MIN_DELAY", uint256(1 days));
        cfg.admin = vm.envOr("CUBIXLES_TIMELOCK_ADMIN", owner);
        cfg.proposer = vm.envOr("CUBIXLES_TIMELOCK_PROPOSER", owner);
        cfg.executor = vm.envOr("CUBIXLES_TIMELOCK_EXECUTOR", owner);
        string memory root = vm.projectRoot();
        string memory defaultPath = cfg.chainId == 1
            ? string.concat(root, "/deployments/mainnet.json")
            : cfg.chainId == 8453
                ? string.concat(root, "/deployments/base.json")
                : string.concat(root, "/deployments/sepolia.json");
        string memory deploymentPath = vm.envOr(
            "CUBIXLES_DEPLOYMENT_PATH",
            defaultPath
        );
        string memory deploymentJson = vm.readFile(deploymentPath);
        cfg.minter = vm.parseJsonAddress(deploymentJson, ".address");
        cfg.splitter = vm.parseJsonAddress(deploymentJson, ".royaltySplitter");
    }
}
