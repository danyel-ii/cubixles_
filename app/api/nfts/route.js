import { NextResponse } from "next/server";

const NFT_API_VERSION = "v3";
const CACHE_TTL_MS = 30_000;
const cache = new Map();

const ALLOWED_PATHS = new Set([
  "getNFTsForOwner",
  "getNFTMetadata",
  "getFloorPrice",
]);

function getAlchemyKey() {
  return process.env.ALCHEMY_API_KEY;
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

async function readBody(request) {
  if (request.method !== "POST") {
    return {};
  }
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
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
  const apiKey = getAlchemyKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ALCHEMY_API_KEY" }, { status: 500 });
  }

  const body = await readBody(request);
  const query = parseQuery(request);
  const mode = body.mode || query.mode || "alchemy";
  const chainId = Number(body.chainId || query.chainId || 11155111);

  try {
    if (mode === "rpc") {
      const calls = Array.isArray(body.calls) ? body.calls : [];
      if (!calls.length) {
        return NextResponse.json({ error: "Missing calls" }, { status: 400 });
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
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return NextResponse.json(
          { error: `RPC call failed (${response.status})` },
          { status: response.status }
        );
      }
      const json = await response.json();
      return NextResponse.json(json);
    }

    const path = body.path || query.path;
    if (!path || typeof path !== "string" || !ALLOWED_PATHS.has(path)) {
      return NextResponse.json({ error: "Unsupported path" }, { status: 400 });
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
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      return NextResponse.json(
        { error: `Alchemy request failed (${response.status})` },
        { status: response.status }
      );
    }
    const json = await response.json();
    const payload = minimizeResponse(path, json.result ?? json);
    cache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Request failed" },
      { status: 500 }
    );
  }
}
