import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";

import { requireEnv } from "../../../../src/server/env.js";
import { checkRateLimit } from "../../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../../src/server/request.js";
import { logRequest } from "../../../../src/server/log.js";
import { getCache, setCache } from "../../../../src/server/cache.js";
import { getBuilderContractAddress } from "../../../../src/server/builder-config.js";
import { fetchWithGateways } from "../../../../src/shared/ipfs-fetch.js";
import { safeFetch, getHostAllowlist } from "../../../../src/server/safe-fetch.js";
import { IPFS_GATEWAYS } from "../../../../src/shared/uri-policy.js";

const CACHE_TTL_MS = 60_000;
const MAX_LIMIT = 120;
const DEFAULT_LIMIT = 48;
const MAX_METADATA_BYTES = 1_000_000;
const DEFAULT_ALLOWED_HOSTS = [
  ...IPFS_GATEWAYS.map((gateway) => new URL(gateway).hostname),
  "arweave.net",
  "ar-io.net",
];

const BUILDER_ABI = [
  "function totalMinted() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
];

function getRpcUrl(chainId, apiKey) {
  if (chainId === 1) {
    return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
  if (chainId === 8453) {
    return process.env.BASE_RPC_URL || `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
  if (chainId === 11155111) {
    return `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`;
  }
  throw new Error("Unsupported chain.");
}

async function fetchMetadata(tokenUri) {
  if (!tokenUri) {
    return null;
  }
  try {
    const normalized = normalizeMetadataUri(tokenUri);
    if (!normalized) {
      return null;
    }
    if (normalized.startsWith("ipfs://")) {
      const { response } = await fetchWithGateways(normalized, { expectsJson: true });
      return await response.json();
    }
    const allowlist = getHostAllowlist(
      "BUILDER_METADATA_ALLOWED_HOSTS",
      DEFAULT_ALLOWED_HOSTS
    );
    const { buffer } = await safeFetch(normalized, {
      allowlist,
      maxBytes: MAX_METADATA_BYTES,
      headers: { Accept: "application/json" },
    });
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    return null;
  }
}

function normalizeMetadataUri(tokenUri) {
  if (typeof tokenUri !== "string") {
    return "";
  }
  const trimmed = tokenUri.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("ar://")) {
    return `https://arweave.net/${trimmed.slice("ar://".length)}`;
  }
  return trimmed;
}

export async function GET(request) {
  const requestId = makeRequestId();
  const ip = getClientIp(request);
  const rate = await checkRateLimit(`builder:tokens:${ip}`, {
    capacity: 10,
    refillPerSec: 0.2,
  });
  if (!rate.ok) {
    logRequest({ route: "/api/builder/tokens", status: 429, requestId, bodySize: 0 });
    return NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const chainId = Number(searchParams.get("chainId") || 1);
  const limitRaw = Number(searchParams.get("limit") || DEFAULT_LIMIT);
  const limit = Math.max(1, Math.min(MAX_LIMIT, limitRaw));
  const cacheKey = `builder:tokens:${chainId}:${limit}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    const cachedResponse = NextResponse.json(cached);
    cachedResponse.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    logRequest({ route: "/api/builder/tokens", status: 200, requestId, bodySize: 0 });
    return cachedResponse;
  }

  try {
    const address = getBuilderContractAddress(chainId);
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json(
        { error: "Builder contract not configured", requestId },
        { status: 400 }
      );
    }
    const apiKey = requireEnv("ALCHEMY_API_KEY");
    const provider = new JsonRpcProvider(getRpcUrl(chainId, apiKey));
    const contract = new Contract(address, BUILDER_ABI, provider);
    const totalMintedRaw = await contract.totalMinted();
    const totalMinted = Number(totalMintedRaw);
    const start = Math.max(1, totalMinted - limit + 1);
    const tokenIds = [];
    for (let tokenId = totalMinted; tokenId >= start; tokenId -= 1) {
      tokenIds.push(tokenId);
    }
    const tokens = await Promise.all(
      tokenIds.map(async (tokenId) => {
        let tokenURI = "";
        try {
          tokenURI = await contract.tokenURI(tokenId);
        } catch (error) {
          tokenURI = "";
        }
        const metadata = await fetchMetadata(tokenURI);
        return {
          tokenId: String(tokenId),
          tokenURI,
          name: metadata?.name ?? null,
          description: metadata?.description ?? null,
          image: metadata?.image || metadata?.image_url || null,
          animationUrl: metadata?.animation_url || null,
          externalUrl: metadata?.external_url || null,
          mintPriceEth: metadata?.builder?.mintPriceEth ?? null,
          mintPriceWei: metadata?.builder?.mintPriceWei ?? null,
          totalFloorEth: metadata?.builder?.totalFloorEth ?? null,
          totalFloorWei: metadata?.builder?.totalFloorWei ?? null,
        };
      })
    );
    const payload = {
      chainId,
      address,
      totalMinted,
      tokens,
    };
    await setCache(cacheKey, payload, CACHE_TTL_MS);
    logRequest({ route: "/api/builder/tokens", status: 200, requestId, bodySize: 0 });
    return NextResponse.json(payload);
  } catch (error) {
    const status = error?.status || 500;
    logRequest({ route: "/api/builder/tokens", status, requestId, bodySize: 0 });
    return NextResponse.json(
      { error: error?.message || "Failed to load builder tokens", requestId },
      { status }
    );
  }
}
