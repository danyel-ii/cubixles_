import mainnetDeployment from "../../../../contracts/deployments/mainnet.json";
import baseDeployment from "../../../../contracts/deployments/base.json";
import sepoliaDeployment from "../../../../contracts/deployments/sepolia.json";
import { readEnvValue } from "../shared/utils/env.js";

const MAINNET_ID = 1;
const BASE_ID = 8453;
const SEPOLIA_ID = 11155111;
const STORAGE_KEY = "cubixles:chainId";
const DEFAULT_CHAIN_ID = Number(readEnvValue("NEXT_PUBLIC_DEFAULT_CHAIN_ID") || MAINNET_ID);

function normalizeRpcUrls(urls) {
  return urls.filter((url) => typeof url === "string" && url.trim().length > 0);
}

function buildChain(id, overrides) {
  return {
    id,
    key: overrides.key,
    name: overrides.name,
    shortName: overrides.shortName,
    explorer: overrides.explorer,
    supportsLess: overrides.supportsLess,
    deployment: overrides.deployment,
    rpcUrls: normalizeRpcUrls(overrides.rpcUrls || []),
  };
}

const CHAIN_LIST = [
  buildChain(MAINNET_ID, {
    key: "mainnet",
    name: "Ethereum Mainnet",
    shortName: "Mainnet",
    explorer: "https://etherscan.io",
    supportsLess: true,
    deployment: mainnetDeployment,
    rpcUrls: [
      readEnvValue("NEXT_PUBLIC_MAINNET_RPC_URL"),
      "https://cloudflare-eth.com",
      "https://eth.llamarpc.com",
      "https://rpc.ankr.com/eth",
    ],
  }),
  buildChain(BASE_ID, {
    key: "base",
    name: "Base",
    shortName: "Base",
    explorer: "https://basescan.org",
    supportsLess: false,
    deployment: baseDeployment,
    rpcUrls: [
      readEnvValue("NEXT_PUBLIC_BASE_RPC_URL"),
      "https://mainnet.base.org",
      "https://base.llamarpc.com",
      "https://1rpc.io/base",
    ],
  }),
  buildChain(SEPOLIA_ID, {
    key: "sepolia",
    name: "Sepolia",
    shortName: "Sepolia",
    explorer: "https://sepolia.etherscan.io",
    supportsLess: false,
    deployment: sepoliaDeployment,
    rpcUrls: [
      readEnvValue("NEXT_PUBLIC_SEPOLIA_RPC_URL"),
      "https://rpc.sepolia.org",
      "https://ethereum-sepolia.publicnode.com",
    ],
  }),
];

const CHAIN_BY_ID = new Map(CHAIN_LIST.map((chain) => [chain.id, chain]));

let activeChainId = DEFAULT_CHAIN_ID;
let hasStoredPreference = false;
const listeners = new Set();

if (!CHAIN_BY_ID.has(activeChainId)) {
  activeChainId = MAINNET_ID;
}

if (typeof window !== "undefined") {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (CHAIN_BY_ID.has(parsed)) {
      activeChainId = parsed;
      hasStoredPreference = true;
    }
  }
}

function notify() {
  listeners.forEach((listener) => listener(activeChainId));
  if (typeof document !== "undefined") {
    document.dispatchEvent(
      new CustomEvent("cubixles-chain-change", { detail: { chainId: activeChainId } })
    );
  }
}

export function getChainOptions() {
  return [...CHAIN_LIST];
}

export function getChainConfig(chainId) {
  return CHAIN_BY_ID.get(chainId) || CHAIN_BY_ID.get(MAINNET_ID);
}

export function formatChainName(chainId) {
  const chain = getChainConfig(chainId);
  if (!chain) {
    return `Chain ${chainId}`;
  }
  return chain.name;
}

export function formatChainShortName(chainId) {
  const chain = getChainConfig(chainId);
  if (!chain) {
    return `Chain ${chainId}`;
  }
  return chain.shortName;
}

export function isSupportedChainId(chainId) {
  return CHAIN_BY_ID.has(chainId);
}

export function getActiveChainId() {
  return activeChainId;
}

export function getActiveChain() {
  return getChainConfig(activeChainId);
}

export function hasStoredChainPreference() {
  return hasStoredPreference;
}

export function setActiveChainId(chainId) {
  if (!CHAIN_BY_ID.has(chainId)) {
    return false;
  }
  if (chainId === activeChainId) {
    return true;
  }
  activeChainId = chainId;
  hasStoredPreference = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, String(chainId));
  }
  notify();
  return true;
}

export function subscribeActiveChain(listener) {
  listeners.add(listener);
  listener(activeChainId);
  return () => listeners.delete(listener);
}

export function resetStoredChainPreference() {
  hasStoredPreference = false;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
