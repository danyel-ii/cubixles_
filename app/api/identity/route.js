import { NextResponse } from "next/server";
import { JsonRpcProvider, getAddress } from "ethers";

function getRpcUrl() {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) {
    return null;
  }
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
  const url = new URL(request.url);
  const rawAddress = url.searchParams.get("address");
  if (!rawAddress) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  let address;
  try {
    address = getAddress(rawAddress);
  } catch (error) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const [farcaster, ens] = await Promise.all([
    resolveFarcaster(address),
    resolveEns(address),
  ]);

  return NextResponse.json({
    address,
    farcaster,
    ens: ens || null,
  });
}
