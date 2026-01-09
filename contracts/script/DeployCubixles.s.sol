// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script } from "forge-std/Script.sol";
import { CubixlesMinter } from "../src/cubixles/CubixlesMinter.sol";
import { CubixlesV1_0 } from "../src/cubixles_v.1.0..sol";
import { RoyaltySplitter } from "../src/royalties/RoyaltySplitter.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";

contract DeployCubixles is Script {
    function run() external {
        DeployConfig memory cfg = _loadConfig();
        if (cfg.chainId == 8453) {
            require(cfg.linearPricingEnabled, "Base requires linear pricing");
            require(cfg.lessToken == address(0), "Base requires LESS disabled");
            require(cfg.fixedMintPriceWei == 0, "Base forbids fixed mint pricing");
        }
        if (cfg.poolManager != address(0)) {
            require(cfg.tickSpacing != 0, "CUBIXLES_POOL_TICK_SPACING required");
            require(cfg.pnkTickSpacing != 0, "CUBIXLES_PNKSTR_POOL_TICK_SPACING required");
        }
        PoolKey memory lessPoolKey = _buildPoolKey(
            cfg.lessToken,
            cfg.poolFee,
            cfg.tickSpacing,
            cfg.hooks
        );
        PoolKey memory pnkPoolKey = _buildPoolKey(
            cfg.pnkstrToken,
            cfg.pnkPoolFee,
            cfg.pnkTickSpacing,
            cfg.pnkHooks
        );

        vm.startBroadcast();
        CubixlesV1_0 asciiArt = new CubixlesV1_0();
        RoyaltySplitter splitter = new RoyaltySplitter(
            cfg.owner,
            cfg.lessToken,
            cfg.pnkstrToken,
            IPoolManager(cfg.poolManager),
            lessPoolKey,
            pnkPoolKey,
            cfg.swapMaxSlippageBps
        );
        CubixlesMinter minter = new CubixlesMinter(
            address(splitter),
            cfg.lessToken,
            cfg.resaleRoyaltyBps,
            cfg.fixedMintPriceWei,
            cfg.baseMintPriceWei,
            cfg.baseMintPriceStepWei,
            cfg.linearPricingEnabled,
            cfg.paletteImagesCID,
            cfg.paletteManifestHash,
            cfg.vrfCoordinator,
            cfg.vrfKeyHash,
            cfg.vrfSubscriptionId,
            cfg.vrfRequestConfirmations,
            cfg.vrfCallbackGasLimit
        );
        if (cfg.owner != msg.sender) {
            minter.transferOwnership(cfg.owner);
        }
        vm.stopBroadcast();

        string memory root = vm.projectRoot();
        string memory defaultPath = cfg.chainId == 1
            ? string.concat(root, "/deployments/mainnet.json")
            : cfg.chainId == 8453
                ? string.concat(root, "/deployments/base.json")
                : string.concat(root, "/deployments/sepolia.json");
        string memory path = vm.envOr("CUBIXLES_DEPLOYMENT_PATH", defaultPath);
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", cfg.chainId);
        string memory json = vm.serializeAddress(obj, "address", address(minter));
        json = vm.serializeAddress(obj, "royaltySplitter", address(splitter));
        json = vm.serializeAddress(obj, "asciiArt", address(asciiArt));
        vm.writeJson(json, path);
    }

    struct DeployConfig {
        uint256 chainId;
        address owner;
        address lessToken;
        address pnkstrToken;
        address poolManager;
        uint24 poolFee;
        int24 tickSpacing;
        address hooks;
        uint24 pnkPoolFee;
        int24 pnkTickSpacing;
        address pnkHooks;
        uint96 resaleRoyaltyBps;
        uint16 swapMaxSlippageBps;
        uint256 fixedMintPriceWei;
        bool linearPricingEnabled;
        uint256 baseMintPriceWei;
        uint256 baseMintPriceStepWei;
        string paletteImagesCID;
        bytes32 paletteManifestHash;
        address vrfCoordinator;
        bytes32 vrfKeyHash;
        uint64 vrfSubscriptionId;
        uint16 vrfRequestConfirmations;
        uint32 vrfCallbackGasLimit;
    }

    function _loadConfig() internal view returns (DeployConfig memory cfg) {
        cfg.chainId = vm.envOr("CUBIXLES_CHAIN_ID", block.chainid);
        cfg.owner = vm.envAddress("CUBIXLES_OWNER");
        address lessTokenDefault = cfg.chainId == 8453
            ? address(0)
            : address(0x9C2CA573009F181EAc634C4d6e44A0977C24f335);
        cfg.lessToken = vm.envOr("CUBIXLES_LESS_TOKEN", lessTokenDefault);
        cfg.pnkstrToken = vm.envOr("CUBIXLES_PNKSTR_TOKEN", address(0));
        cfg.poolManager = vm.envOr("CUBIXLES_POOL_MANAGER", address(0));
        cfg.poolFee = uint24(vm.envOr("CUBIXLES_POOL_FEE", uint256(0)));
        cfg.tickSpacing = int24(int256(vm.envOr("CUBIXLES_POOL_TICK_SPACING", uint256(0))));
        cfg.hooks = vm.envOr("CUBIXLES_POOL_HOOKS", address(0));
        cfg.pnkPoolFee = uint24(vm.envOr("CUBIXLES_PNKSTR_POOL_FEE", uint256(0)));
        cfg.pnkTickSpacing = int24(int256(vm.envOr("CUBIXLES_PNKSTR_POOL_TICK_SPACING", uint256(0))));
        cfg.pnkHooks = vm.envOr("CUBIXLES_PNKSTR_POOL_HOOKS", address(0));
        cfg.resaleRoyaltyBps = uint96(vm.envOr("CUBIXLES_RESALE_BPS", uint256(500)));
        cfg.swapMaxSlippageBps = uint16(vm.envOr("CUBIXLES_SWAP_MAX_SLIPPAGE_BPS", uint256(0)));
        cfg.fixedMintPriceWei = vm.envOr("CUBIXLES_FIXED_MINT_PRICE_WEI", uint256(0));
        cfg.linearPricingEnabled = vm.envOr(
            "CUBIXLES_LINEAR_PRICING_ENABLED",
            cfg.chainId == 8453
        );
        cfg.baseMintPriceWei = vm.envOr(
            "CUBIXLES_BASE_MINT_PRICE_WEI",
            cfg.chainId == 8453 ? 1_200_000_000_000_000 : 0
        );
        cfg.baseMintPriceStepWei = vm.envOr(
            "CUBIXLES_BASE_MINT_PRICE_STEP_WEI",
            cfg.chainId == 8453 ? 12_000_000_000_000 : 0
        );
        cfg.paletteImagesCID = vm.envString("CUBIXLES_PALETTE_IMAGES_CID");
        cfg.paletteManifestHash = vm.envBytes32("CUBIXLES_PALETTE_MANIFEST_HASH");
        cfg.vrfCoordinator = vm.envAddress("CUBIXLES_VRF_COORDINATOR");
        cfg.vrfKeyHash = vm.envBytes32("CUBIXLES_VRF_KEY_HASH");
        cfg.vrfSubscriptionId = uint64(vm.envUint("CUBIXLES_VRF_SUBSCRIPTION_ID"));
        cfg.vrfRequestConfirmations = uint16(
            vm.envOr("CUBIXLES_VRF_REQUEST_CONFIRMATIONS", uint256(3))
        );
        cfg.vrfCallbackGasLimit = uint32(
            vm.envOr("CUBIXLES_VRF_CALLBACK_GAS_LIMIT", uint256(250_000))
        );
    }

    function _buildPoolKey(
        address lessToken,
        uint24 poolFee,
        int24 tickSpacing,
        address hooks
    ) internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(lessToken),
            fee: poolFee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hooks)
        });
    }
}
