// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script } from "forge-std/Script.sol";
import { CubixlesBuilderMinter } from "../src/builders/CubixlesBuilderMinter.sol";
import { BuilderRoyaltyForwarder } from "../src/royalties/BuilderRoyaltyForwarder.sol";

contract DeployBuilderMinter is Script {
    uint256 private constant ENV_UINT_SENTINEL = type(uint256).max;
    address private constant ENV_ADDRESS_SENTINEL = address(type(uint160).max);

    function run() external {
        DeployConfig memory cfg = _loadConfig();

        vm.startBroadcast();
        address forwarderImpl = cfg.royaltyForwarderImpl;
        if (forwarderImpl == address(0)) {
            forwarderImpl = address(new BuilderRoyaltyForwarder());
        }
        CubixlesBuilderMinter minter = new CubixlesBuilderMinter(
            cfg.name,
            cfg.symbol,
            cfg.baseUri
        );
        minter.setRoyaltyForwarderImpl(forwarderImpl);
        if (cfg.quoteSigner != address(0)) {
            minter.setQuoteSigner(cfg.quoteSigner);
        }
        if (cfg.owner != msg.sender) {
            minter.transferOwnership(cfg.owner);
        }
        vm.stopBroadcast();

        string memory root = vm.projectRoot();
        string memory defaultPath = cfg.chainId == 1
            ? string.concat(root, "/deployments/builder-mainnet.json")
            : cfg.chainId == 8453
                ? string.concat(root, "/deployments/builder-base.json")
                : string.concat(root, "/deployments/builder-sepolia.json");
        string memory path = vm.envOr("CUBIXLES_BUILDER_DEPLOYMENT_PATH", defaultPath);
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", cfg.chainId);
        vm.serializeAddress(obj, "address", address(minter));
        string memory json = vm.serializeAddress(obj, "royaltyForwarderImpl", forwarderImpl);
        vm.writeJson(json, path);
    }

    struct DeployConfig {
        uint256 chainId;
        address owner;
        address quoteSigner;
        address royaltyForwarderImpl;
        string name;
        string symbol;
        string baseUri;
    }

    function _loadConfig() internal view returns (DeployConfig memory cfg) {
        cfg.chainId = vm.envOr("CUBIXLES_CHAIN_ID", block.chainid);
        cfg.owner = _envOrAddress("CUBIXLES_BUILDER_OWNER", "CUBIXLES_OWNER", msg.sender);
        cfg.quoteSigner = _envOrAddress(
            "CUBIXLES_BUILDER_QUOTE_SIGNER",
            "CUBIXLES_BUILDER_SIGNER",
            address(0)
        );
        cfg.royaltyForwarderImpl = _envOrAddress(
            "CUBIXLES_BUILDER_ROYALTY_FORWARDER_IMPL",
            "CUBIXLES_BUILDER_FORWARDER_IMPL",
            address(0)
        );
        cfg.name = vm.envOr("CUBIXLES_BUILDER_NAME", string("Cubixles Builders"));
        cfg.symbol = vm.envOr("CUBIXLES_BUILDER_SYMBOL", string("BLDR"));
        cfg.baseUri = vm.envOr("CUBIXLES_BUILDER_BASE_URI", string(""));
    }

    function _envOrAddress(
        string memory primary,
        string memory fallbackKey,
        address defaultValue
    ) private view returns (address value) {
        value = vm.envOr(primary, ENV_ADDRESS_SENTINEL);
        if (value == ENV_ADDRESS_SENTINEL) {
            value = vm.envOr(fallbackKey, defaultValue);
        }
    }
}
