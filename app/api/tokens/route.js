import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, formatEther } from "ethers";

import { requireEnv } from "../../../src/server/env.js";
import { checkRateLimit } from "../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../src/server/request.js";
import { logRequest } from "../../../src/server/log.js";
import { getCache, setCache } from "../../../src/server/cache.js";
import { getBuilderContractAddress } from "../../../src/server/builder-config.js";
import { getMinterContractAddress } from "../../../src/server/minter-config.js";
import { fetchWithGateways } from "../../../src/shared/ipfs-fetch.js";
import { safeFetch, getHostAllowlist } from "../../../src/server/safe-fetch.js";
import { IPFS_GATEWAYS } from "../../../src/shared/uri-policy.js";

const CACHE_TTL_MS = 60_000;
const MAX_LIMIT = 120;
const DEFAULT_LIMIT = 8;
const MAX_PAGES = 50;
const DEFAULT_MAX_PAGES = 25;
const MAX_METADATA_BYTES = 1_000_000;
const DEFAULT_ALLOWED_HOSTS = [
  ...IPFS_GATEWAYS.map((gateway) => new URL(gateway).hostname),
  "arweave.net",
  "ar-io.net",
];

const MINTER_ABI = [
  "function totalMinted() view returns (uint256)",
  "function tokenIdByIndex(uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function mintPriceByTokenId(uint256 tokenId) view returns (uint256)",
];

const BUILDER_ABI = [
  "function totalMinted() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function mintPriceByTokenId(uint256 tokenId) view returns (uint256)",
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
      "TOKEN_METADATA_ALLOWED_HOSTS",
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

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

export async function GET(request) {
  const requestId = makeRequestId();
  const ip = getClientIp(request);
  const rate = await checkRateLimit(`minter:tokens:${ip}`, {
    capacity: 10,
    refillPerSec: 0.2,
  });
  if (!rate.ok) {
    logRequest({ route: "/api/tokens", status: 429, requestId, bodySize: 0 });
    return NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const chainId = Number(searchParams.get("chainId") || 1);
  const mode = searchParams.get("mode");
  const isBuilder = mode === "builder";
  const limitRaw = parsePositiveInt(searchParams.get("limit")) ?? DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(MAX_LIMIT, limitRaw));
  const all = searchParams.get("all") === "true";
  const maxPagesRaw = parsePositiveInt(searchParams.get("maxPages")) ?? DEFAULT_MAX_PAGES;
  const maxPages = Math.max(1, Math.min(MAX_PAGES, maxPagesRaw));
  const pageKeyRaw = parsePositiveInt(searchParams.get("pageKey"));
  const pageKey = pageKeyRaw && !all ? pageKeyRaw : null;
  const cacheKey = `${isBuilder ? "builder" : "minter"}:tokens:${chainId}:${limit}:${
    all ? "all" : "page"
  }:${all ? maxPages : pageKey ?? "start"}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    const cachedResponse = NextResponse.json(cached);
    cachedResponse.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    logRequest({ route: "/api/tokens", status: 200, requestId, bodySize: 0 });
    return cachedResponse;
  }

  try {
    const address = isBuilder
      ? getBuilderContractAddress(chainId)
      : getMinterContractAddress(chainId);
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json(
        { error: `${isBuilder ? "Builder" : "Minter"} contract not configured`, requestId },
        { status: 400 }
      );
    }
    const apiKey = requireEnv("ALCHEMY_API_KEY");
    const provider = new JsonRpcProvider(getRpcUrl(chainId, apiKey));
    const contract = new Contract(address, isBuilder ? BUILDER_ABI : MINTER_ABI, provider);
    const totalMintedRaw = await contract.totalMinted();
    const totalMinted = Number(totalMintedRaw);
    if (!Number.isFinite(totalMinted) || totalMinted <= 0) {
      const emptyPayload = {
        chainId,
        address,
        totalMinted: 0,
        tokens: [],
        pageKey: null,
        pages: 0,
        truncated: false,
      };
      await setCache(cacheKey, emptyPayload, CACHE_TTL_MS);
      logRequest({ route: "/api/tokens", status: 200, requestId, bodySize: 0 });
      return NextResponse.json(emptyPayload);
    }

    const pages = all
      ? Math.min(Math.ceil(totalMinted / limit), maxPages)
      : 1;
    const startIndex = all
      ? totalMinted
      : Math.min(totalMinted, pageKey ?? totalMinted);
    const endIndex = all
      ? Math.max(1, totalMinted - pages * limit + 1)
      : Math.max(1, startIndex - limit + 1);
    const indices = [];
    for (let index = startIndex; index >= endIndex; index -= 1) {
      indices.push(index);
    }

    const tokenIds = isBuilder
      ? indices.map((index) => BigInt(index))
      : await Promise.all(
          indices.map(async (index) => {
            try {
              return await contract.tokenIdByIndex(index);
            } catch (error) {
              return null;
            }
          })
        );
    const tokens = await Promise.all(
      tokenIds
        .filter((tokenId) => tokenId !== null)
        .map(async (tokenId) => {
          let tokenURI = "";
          let mintPriceWei = null;
          try {
            const [uri, price] = await Promise.all([
              contract.tokenURI(tokenId),
              contract.mintPriceByTokenId(tokenId),
            ]);
            tokenURI = uri;
            mintPriceWei = price;
          } catch (error) {
            tokenURI = "";
            mintPriceWei = null;
          }
          const metadata = await fetchMetadata(tokenURI);
          const mintPriceEth = mintPriceWei != null ? formatEther(mintPriceWei) : null;
          return {
            tokenId: tokenId.toString(),
            tokenURI,
            metadata,
            title: metadata?.name ?? null,
            name: metadata?.name ?? null,
            description: metadata?.description ?? null,
            image: metadata?.image || metadata?.image_url || metadata?.imageUrl || null,
            animationUrl: metadata?.animation_url || metadata?.animationUrl || null,
            externalUrl: metadata?.external_url || metadata?.externalUrl || null,
            mintPriceWei: mintPriceWei != null ? mintPriceWei.toString() : null,
            mintPriceEth,
          };
        })
    );
    const nextIndex = endIndex - 1;
    const truncated = all && nextIndex >= 1;
    const payload = {
      chainId,
      address,
      totalMinted,
      tokens,
      pageKey: nextIndex >= 1 ? String(nextIndex) : null,
      pages,
      truncated,
    };
    await setCache(cacheKey, payload, CACHE_TTL_MS);
    logRequest({ route: "/api/tokens", status: 200, requestId, bodySize: 0 });
    return NextResponse.json(payload);
  } catch (error) {
    const status = error?.status || 500;
    logRequest({ route: "/api/tokens", status, requestId, bodySize: 0 });
    return NextResponse.json(
      { error: error?.message || "Failed to load tokens", requestId },
      { status }
    );
  }
}
