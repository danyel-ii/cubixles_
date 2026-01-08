import { NextResponse } from "next/server";
import { JsonRpcProvider, getAddress } from "ethers";
import { requireEnv } from "../../../src/server/env.js";
import { checkRateLimit } from "../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../src/server/request.js";
import { logRequest } from "../../../src/server/log.js";
import { identityRequestSchema } from "../../../src/server/validate.js";
import { getCache, setCache } from "../../../src/server/cache.js";

function getRpcUrl() {
  const key = requireEnv("ALCHEMY_API_KEY");
  return `https://eth-mainnet.g.alchemy.com/v2/${key}`;
}

async function resolveEns(address) {
  const rpcUrl = getRpcUrl();
  if (!rpcUrl) {
    return null;
  }
  const provider = new JsonRpcProvider(rpcUrl);
  try {
    return await provider.lookupAddress(address);
  } catch (error) {
    return null;
  }
}

async function resolveFarcaster(address) {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return null;
  }
  const url = new URL("https://api.neynar.com/v2/farcaster/user/bulk-by-address");
  url.searchParams.set("addresses", address);
  const response = await fetch(url.toString(), {
    headers: { accept: "application/json", api_key: apiKey },
  });
  if (!response.ok) {
    return null;
  }
  const json = await response.json();
  const users = Array.isArray(json?.users) ? json.users : [];
  const user = users[0];
  if (!user) {
    return null;
  }
  const username = user.username || null;
  return {
    fid: user.fid ?? null,
    username,
    url: username ? `https://warpcast.com/${username}` : null,
  };
}

export async function GET(request) {
  const requestId = makeRequestId();
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`identity:ip:${ip}`, { capacity: 20, refillPerSec: 1 });
  if (!limit.ok) {
    logRequest({ route: "/api/identity", status: 429, requestId, bodySize: 0 });
    return NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429 });
  }

  const url = new URL(request.url);
  const rawAddress = url.searchParams.get("address");
  if (!rawAddress) {
    return NextResponse.json({ error: "Missing address", requestId }, { status: 400 });
  }

  const validation = identityRequestSchema.safeParse({ address: rawAddress });
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid address", requestId }, { status: 400 });
  }

  let address;
  try {
    address = getAddress(rawAddress);
  } catch (error) {
    return NextResponse.json({ error: "Invalid address", requestId }, { status: 400 });
  }

  const cacheKey = `identity:${address.toLowerCase()}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    logRequest({ route: "/api/identity", status: 200, requestId, bodySize: 0, actor: address });
    return NextResponse.json({ ...cached, requestId });
  }

  try {
    const [farcaster, ens] = await Promise.all([
      resolveFarcaster(address),
      resolveEns(address),
    ]);

    const payload = {
      address,
      farcaster,
      ens: ens || null,
    };
    await setCache(cacheKey, payload, 60_000);
    logRequest({ route: "/api/identity", status: 200, requestId, bodySize: 0, actor: address });
    return NextResponse.json({ ...payload, requestId });
  } catch (error) {
    logRequest({ route: "/api/identity", status: 500, requestId, bodySize: 0, actor: address });
    return NextResponse.json(
      { error: error?.message || "Identity lookup failed", requestId },
      { status: 500 }
    );
  }
}
