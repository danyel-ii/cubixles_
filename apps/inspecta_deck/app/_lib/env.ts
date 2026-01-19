import baseDeployment from "../../../../contracts/deployments/base.json";
import mainnetDeployment from "../../../../contracts/deployments/mainnet.json";

type CacheTtls = {
  tokens: number;
  metadata: number;
  provenance: number;
  owners: number;
  verify: number;
};

export type EnvConfig = {
  alchemyKey: string;
  network: string;
  contractAddress: string;
  cacheProvider: string;
  redisUrl?: string;
  cacheTtls: CacheTtls;
};

const FALLBACK_CONTRACT_BY_CHAIN: Record<number, string | undefined> = {
  1: mainnetDeployment.address,
  8453: baseDeployment.address,
};

const cachedConfigByChain = new Map<string, EnvConfig>();

const NETWORK_BY_CHAIN_ID: Record<number, string> = {
  1: "eth-mainnet",
  5: "eth-goerli",
  11155111: "eth-sepolia",
  137: "polygon-mainnet",
  80001: "polygon-mumbai",
  8453: "base-mainnet",
  84532: "base-sepolia",
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  let trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const quote = trimmed[0];
  if ((quote === "\"" || quote === "'") && trimmed.endsWith(quote)) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  const prefix = `${name}=`;
  if (trimmed.startsWith(prefix)) {
    trimmed = trimmed.slice(prefix.length).trim();
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireEnv(names: string[], label: string): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) {
      return value;
    }
  }
  throw new Error(`Missing required env var: ${label}`);
}

function resolveChainId(chainIdOverride?: number): number | null {
  if (typeof chainIdOverride === "number" && Number.isFinite(chainIdOverride)) {
    return chainIdOverride;
  }
  const chainIdRaw = readEnv("CUBIXLES_CHAIN_ID") ?? readEnv("BASE_CHAIN_ID");
  if (chainIdRaw) {
    const chainId = Number.parseInt(chainIdRaw, 10);
    if (Number.isFinite(chainId)) {
      return chainId;
    }
  }
  return null;
}

function extractAddress(value: string): string | null {
  const match = value.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : null;
}

function resolveNetwork(chainIdOverride?: number): string {
  const chainId = resolveChainId(chainIdOverride);
  if (chainId && NETWORK_BY_CHAIN_ID[chainId]) {
    return NETWORK_BY_CHAIN_ID[chainId];
  }
  const direct = readEnv("NETWORK");
  if (direct) {
    return direct;
  }
  throw new Error("Missing required env var: NETWORK");
}

function resolveContractAddress(chainIdOverride?: number): string {
  const chainId = resolveChainId(chainIdOverride);
  if (chainId === 8453) {
    const baseContract = readEnv("CUBIXLES_BASE_CONTRACT_ADDRESS");
    if (baseContract) {
      const extracted = extractAddress(baseContract);
      if (extracted) {
        return extracted;
      }
    }
  }
  const direct =
    readEnv("CUBIXLES_CONTRACT") ?? readEnv("CUBIXLES_CONTRACT_ADDRESS");
  if (direct) {
    const extracted = extractAddress(direct);
    if (extracted) {
      return extracted;
    }
  }
  const fallback = chainId ? FALLBACK_CONTRACT_BY_CHAIN[chainId] : undefined;
  if (fallback) {
    return fallback;
  }
  return requireEnv(
    ["CUBIXLES_CONTRACT", "CUBIXLES_CONTRACT_ADDRESS"],
    "CUBIXLES_CONTRACT"
  );
}

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getEnvConfig(chainIdOverride?: number): EnvConfig {
  const chainId = resolveChainId(chainIdOverride);
  const cacheKey = chainId ? String(chainId) : "default";
  const cached = cachedConfigByChain.get(cacheKey);
  if (cached) {
    return cached;
  }

  const alchemyKey = requireEnv(["ALCHEMY_KEY", "ALCHEMY_API_KEY"], "ALCHEMY_KEY");
  const network = resolveNetwork(chainId);
  const contractAddress = resolveContractAddress(chainId);

  const config = {
    alchemyKey,
    network,
    contractAddress,
    cacheProvider: process.env.CACHE_PROVIDER ?? "memory",
    redisUrl: process.env.REDIS_URL,
    cacheTtls: {
      tokens: parseNumberEnv("CACHE_TTL_TOKENS", 600),
      metadata: parseNumberEnv("CACHE_TTL_METADATA", 86400),
      provenance: parseNumberEnv("CACHE_TTL_PROVENANCE", 600),
      owners: parseNumberEnv("CACHE_TTL_OWNERS", 600),
      verify: parseNumberEnv("CACHE_TTL_VERIFY", 60),
    },
  };
  cachedConfigByChain.set(cacheKey, config);
  return config;
}

export function getAlchemyNftBaseUrl(chainIdOverride?: number): string {
  const { network, alchemyKey } = getEnvConfig(chainIdOverride);
  return `https://${network}.g.alchemy.com/nft/v3/${alchemyKey}`;
}

export function getAlchemyRpcUrl(chainIdOverride?: number): string {
  const { network, alchemyKey } = getEnvConfig(chainIdOverride);
  return `https://${network}.g.alchemy.com/v2/${alchemyKey}`;
}
