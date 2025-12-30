import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireEnv, readEnvBool } from "../../../src/server/env.js";
import { checkRateLimit } from "../../../src/server/ratelimit.js";
import { getClientIp } from "../../../src/server/request.js";
import { logRequest } from "../../../src/server/log.js";
import { nftRequestSchema, readJsonWithLimit, formatZodError } from "../../../src/server/validate.js";
import { getCache, setCache } from "../../../src/server/cache.js";
import { recordMetric } from "../../../src/server/metrics.js";

const NFT_API_VERSION = "v3";
const CACHE_TTL_MS = 60_000;
const MAX_BODY_BYTES = 12 * 1024;

const ALLOWED_PATHS = new Set([
  "getNFTsForOwner",
  "getNFTMetadata",
  "getFloorPrice",
]);

function getAlchemyKey() {
  return requireEnv("ALCHEMY_API_KEY");
}

function getNftBaseUrl(chainId, apiKey) {
  if (chainId === 1) {
    return `https://eth-mainnet.g.alchemy.com/nft/${NFT_API_VERSION}/${apiKey}`;
  }
  if (chainId === 11155111) {
    return `https://eth-sepolia.g.alchemy.com/nft/${NFT_API_VERSION}/${apiKey}`;
  }
  throw new Error("Unsupported chain for Alchemy NFT API.");
}

function getRpcUrl(chainId, apiKey) {
  if (chainId === 1) {
    return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
  if (chainId === 11155111) {
    return `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`;
  }
  throw new Error("Unsupported chain for Alchemy RPC.");
}

function trimNft(nft) {
  if (!nft || typeof nft !== "object") {
    return nft;
  }
  return {
    contract: nft.contract ? { address: nft.contract.address } : undefined,
    tokenId: nft.tokenId,
    tokenType: nft.tokenType,
    name: nft.name ?? null,
    tokenUri: nft.tokenUri ?? null,
    collection: nft.collection ? { name: nft.collection.name } : undefined,
    image: nft.image
      ? {
          cachedUrl: nft.image.cachedUrl ?? null,
          originalUrl: nft.image.originalUrl ?? null,
        }
      : null,
    metadata: nft.metadata ?? null,
    raw: nft.raw ?? null,
  };
}

function minimizeResponse(path, data) {
  if (path === "getNFTsForOwner") {
    const owned = Array.isArray(data?.ownedNfts) ? data.ownedNfts : [];
    return { ownedNfts: owned.map(trimNft) };
  }
  if (path === "getNFTMetadata") {
    return trimNft(data);
  }
  return data;
}

function parseQuery(request) {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}

export async function GET(request) {
  return handleRequest(request);
}

export async function POST(request) {
  return handleRequest(request);
}

async function handleRequest(request) {
  const requestId = crypto.randomUUID();
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`nfts:ip:${ip}`, { capacity: 30, refillPerSec: 1 });
  if (!limit.ok) {
    logRequest({ route: "/api/nfts", status: 429, requestId, bodySize: 0 });
    return NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429 });
  }

  let body = {};
  let bodySize = 0;
  if (request.method === "POST") {
    try {
      const parsed = await readJsonWithLimit(request, MAX_BODY_BYTES);
      body = parsed.data;
      bodySize = parsed.size;
    } catch (error) {
      const status = error?.status || 400;
      logRequest({ route: "/api/nfts", status, requestId, bodySize });
      return NextResponse.json({ error: error.message, requestId }, { status });
    }
  }
  const query = parseQuery(request);
  const mode = body.mode || query.mode || "alchemy";
  const chainId = Number(body.chainId || query.chainId || 11155111);
  const path = body.path || query.path;
  const requestShape = {
    mode,
    chainId,
    path,
    query: body.query || {},
    calls: body.calls || undefined,
  };

  const validation = nftRequestSchema.safeParse(requestShape);
  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error), requestId },
      { status: 400 }
    );
  }

  try {
    const apiKey = getAlchemyKey();
    if (mode === "rpc") {
      if (readEnvBool("DISABLE_ALCHEMY_RPC", false)) {
        recordMetric("alchemy.rpc.disabled");
        return NextResponse.json(
          { error: "RPC calls are temporarily disabled", requestId },
          { status: 503 }
        );
      }
      const calls = Array.isArray(validation.data.calls) ? validation.data.calls : [];
      if (!calls.length) {
        return NextResponse.json({ error: "Missing calls", requestId }, { status: 400 });
      }
      if (calls.length > 20) {
        return NextResponse.json({ error: "Too many calls", requestId }, { status: 400 });
      }
      const payload = calls.map((call, index) => ({
        jsonrpc: "2.0",
        id: index + 1,
        method: "eth_call",
        params: [
          {
            to: call.to,
            data: call.data,
          },
          "latest",
        ],
      }));
      const rpcUrl = getRpcUrl(chainId, apiKey);
      const rpcResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!rpcResponse.ok) {
        return NextResponse.json(
          { error: `RPC call failed (${rpcResponse.status})`, requestId },
          { status: rpcResponse.status }
        );
      }
      const json = await rpcResponse.json();
      logRequest({ route: "/api/nfts", status: 200, requestId, bodySize });
      return NextResponse.json(json);
    }

    if (!path || typeof path !== "string" || !ALLOWED_PATHS.has(path)) {
      return NextResponse.json({ error: "Unsupported path", requestId }, { status: 400 });
    }
    const params = body.query || {};
    const baseUrl = getNftBaseUrl(chainId, apiKey);
    const url = new URL(`${baseUrl}/${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry !== undefined && entry !== null) {
            url.searchParams.append(key, String(entry));
          }
        });
        return;
      }
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const cacheKey = url.toString();
    const cached = await getCache(cacheKey);
    if (cached) {
      const cachedResponse = NextResponse.json(cached);
      cachedResponse.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
      logRequest({ route: "/api/nfts", status: 200, requestId, bodySize });
      return cachedResponse;
    }

    if (readEnvBool("DISABLE_ALCHEMY_API", false)) {
      recordMetric("alchemy.api.disabled");
      const fallback = await getCache(`${cacheKey}:fallback`);
      if (fallback) {
        const fallbackResponse = NextResponse.json(fallback);
        fallbackResponse.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
        logRequest({ route: "/api/nfts", status: 200, requestId, bodySize });
        return fallbackResponse;
      }
      return NextResponse.json(
        { error: "Alchemy API temporarily disabled", requestId },
        { status: 503 }
      );
    }

    const alchemyResponse = await fetch(url.toString());
    if (!alchemyResponse.ok) {
      const fallback = await getCache(`${cacheKey}:fallback`);
      if (fallback) {
        const fallbackResponse = NextResponse.json(fallback);
        fallbackResponse.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
        logRequest({ route: "/api/nfts", status: 200, requestId, bodySize });
        return fallbackResponse;
      }
      return NextResponse.json(
        { error: `Alchemy request failed (${alchemyResponse.status})`, requestId },
        { status: alchemyResponse.status }
      );
    }
    const json = await alchemyResponse.json();
    const payload = minimizeResponse(path, json.result ?? json);
    await setCache(cacheKey, payload, CACHE_TTL_MS);
    await setCache(`${cacheKey}:fallback`, payload);
    const payloadResponse = NextResponse.json(payload);
    payloadResponse.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    logRequest({ route: "/api/nfts", status: 200, requestId, bodySize });
    return payloadResponse;
  } catch (error) {
    logRequest({ route: "/api/nfts", status: 500, requestId, bodySize });
    return NextResponse.json(
      { error: error?.message || "Request failed", requestId },
      { status: 500 }
    );
  }
}
