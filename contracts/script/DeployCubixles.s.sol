// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script } from "forge-std/Script.sol";
import { CubixlesMinter } from "../src/cubixles/CubixlesMinter.sol";
import { RoyaltySplitter } from "../src/royalties/RoyaltySplitter.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";

contract DeployCubixles is Script {
    function run() external {
        address owner = vm.envAddress("CUBIXLES_OWNER");
        address lessToken = vm.envOr(
            "CUBIXLES_LESS_TOKEN",
            address(0x9C2CA573009F181EAc634C4d6e44A0977C24f335)
        );
        address burnAddress = vm.envOr(
            "CUBIXLES_BURN_ADDRESS",
            address(0x000000000000000000000000000000000000dEaD)
        );
        address poolManager = vm.envOr("CUBIXLES_POOL_MANAGER", address(0));
        uint24 poolFee = uint24(vm.envOr("CUBIXLES_POOL_FEE", uint256(0)));
        int24 tickSpacing = int24(int256(vm.envOr("CUBIXLES_POOL_TICK_SPACING", uint256(0))));
        address hooks = vm.envOr("CUBIXLES_POOL_HOOKS", address(0));
        uint96 resaleRoyaltyBps = uint96(vm.envOr("CUBIXLES_RESALE_BPS", uint256(500)));
        uint16 swapMaxSlippageBps = uint16(vm.envOr("CUBIXLES_SWAP_MAX_SLIPPAGE_BPS", uint256(0)));
        uint256 fixedMintPriceWei = vm.envOr("CUBIXLES_FIXED_MINT_PRICE_WEI", uint256(0));
        if (poolManager != address(0)) {
            require(tickSpacing != 0, "CUBIXLES_POOL_TICK_SPACING required");
        }
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(lessToken),
            fee: poolFee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hooks)
        });

        vm.startBroadcast();
        RoyaltySplitter splitter = new RoyaltySplitter(
            owner,
            lessToken,
            IPoolManager(poolManager),
            poolKey,
            swapMaxSlippageBps,
            burnAddress
        );
        CubixlesMinter minter = new CubixlesMinter(
            address(splitter),
            lessToken,
            resaleRoyaltyBps,
            fixedMintPriceWei
        );
        if (owner != msg.sender) {
            minter.transferOwnership(owner);
        }
        vm.stopBroadcast();

        string memory root = vm.projectRoot();
        uint256 chainId = vm.envOr("CUBIXLES_CHAIN_ID", block.chainid);
        string memory defaultPath = chainId == 1
            ? string.concat(root, "/contracts/deployments/mainnet.json")
            : chainId == 8453
                ? string.concat(root, "/contracts/deployments/base.json")
                : string.concat(root, "/contracts/deployments/sepolia.json");
        string memory path = vm.envOr("CUBIXLES_DEPLOYMENT_PATH", defaultPath);
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", chainId);
        string memory json = vm.serializeAddress(obj, "address", address(minter));
        json = vm.serializeAddress(obj, "royaltySplitter", address(splitter));
        vm.writeJson(json, path);
    }
}
