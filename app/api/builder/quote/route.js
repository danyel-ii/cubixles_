import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  AbiCoder,
  Wallet,
  concat,
  getAddress,
  keccak256,
  parseUnits,
  toBeHex,
  toUtf8Bytes,
  zeroPadValue,
} from "ethers";
import { requireEnv, readEnvNumber } from "../../../../src/server/env.js";
import { checkRateLimit } from "../../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../../src/server/request.js";
import { logRequest } from "../../../../src/server/log.js";
import { recordMetric } from "../../../../src/server/metrics.js";
import {
  builderQuoteRequestSchema,
  formatZodError,
  readJsonWithLimit,
} from "../../../../src/server/validate.js";
import { getBuilderContractAddress } from "../../../../src/server/builder-config.js";
import { enforceOriginAllowlist } from "../../../../src/server/origin.js";

const MAX_BODY_BYTES = 10 * 1024;
const MIN_FLOOR_WEI = 10_000_000_000_000_000n;
const BASE_MINT_PRICE_WEI = 5_500_000_000_000_000n;
const PRICE_BPS = 500n;
const BPS = 10_000n;
const REF_TYPEHASH = keccak256(
  toUtf8Bytes("NftRef(address contractAddress,uint256 tokenId)")
);

function getAlchemyKey() {
  return requireEnv("ALCHEMY_API_KEY");
}

function getNftBaseUrl(chainId, apiKey) {
  if (chainId === 1) {
    return `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}`;
  }
  if (chainId === 8453) {
    return `https://base-mainnet.g.alchemy.com/nft/v3/${apiKey}`;
  }
  if (chainId === 11155111) {
    return `https://eth-sepolia.g.alchemy.com/nft/v3/${apiKey}`;
  }
  throw new Error("Unsupported chain for floor quotes.");
}

function pickFloorEth(payload) {
  const sources = ["openSea", "blur", "looksRare", "x2y2", "reservoir"];
  for (const source of sources) {
    const entry = payload?.[source];
    const floor = entry?.floorPrice;
    const currency = entry?.priceCurrency || "";
    if (typeof floor === "number" && floor > 0) {
      if (!currency || String(currency).toUpperCase().includes("ETH")) {
        return floor;
      }
    }
  }
  for (const source of sources) {
    const entry = payload?.[source];
    const floor = entry?.floorPrice;
    if (typeof floor === "number" && floor > 0) {
      return floor;
    }
  }
  return 0;
}

async function fetchFloorWei(chainId, contractAddress) {
  const apiKey = getAlchemyKey();
  const baseUrl = getNftBaseUrl(chainId, apiKey);
  const url = new URL(`${baseUrl}/getFloorPrice`);
  url.searchParams.set("contractAddress", contractAddress);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Alchemy floor fetch failed (${response.status}) ${text}`);
  }
  const json = await response.json();
  const floorEth = pickFloorEth(json);
  if (!floorEth || Number.isNaN(floorEth)) {
    return 0n;
  }
  return parseUnits(String(floorEth), 18);
}

function buildRefsHash(refs) {
  const coder = AbiCoder.defaultAbiCoder();
  const hashes = refs.map((ref) => {
    return keccak256(
      coder.encode(["bytes32", "address", "uint256"], [
        REF_TYPEHASH,
        ref.contractAddress,
        ref.tokenId,
      ])
    );
  });
  return keccak256(concat(hashes));
}

function buildFloorsHash(floorsWei) {
  const packed = floorsWei.map((floor) => zeroPadValue(toBeHex(floor), 32));
  return keccak256(concat(packed));
}

function randomNonce() {
  return BigInt(`0x${crypto.randomBytes(16).toString("hex")}`);
}

export async function POST(request) {
  const requestId = makeRequestId();
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`builder:quote:${ip}`, {
    capacity: 12,
    refillPerSec: 1,
  });
  if (!limit.ok) {
    logRequest({ route: "/api/builder/quote", status: 429, requestId, bodySize: 0 });
    return NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429 });
  }

  const originCheck = enforceOriginAllowlist(request);
  if (!originCheck.ok) {
    logRequest({ route: "/api/builder/quote", status: originCheck.status, requestId, bodySize: 0 });
    return NextResponse.json(
      { error: originCheck.error || "Origin not allowed", requestId },
      { status: originCheck.status }
    );
  }

  let body = {};
  let bodySize = 0;
  try {
    const parsed = await readJsonWithLimit(request, MAX_BODY_BYTES);
    body = parsed.data;
    bodySize = parsed.size;
  } catch (error) {
    const status = error?.status || 400;
    logRequest({ route: "/api/builder/quote", status, requestId, bodySize: 0 });
    return NextResponse.json({ error: error.message, requestId }, { status });
  }

  const validation = builderQuoteRequestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: formatZodError(validation.error), requestId },
      { status: 400 }
    );
  }

  const { chainId, refs } = validation.data;
  const verifyingContract = getBuilderContractAddress(chainId);
  if (!verifyingContract || verifyingContract === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json(
      { error: "Builder minter not configured for this chain", requestId },
      { status: 400 }
    );
  }

  try {
    const sanitizedRefs = refs.map((ref) => ({
      contractAddress: getAddress(ref.contractAddress),
      tokenId: BigInt(ref.tokenId),
    }));

    const floorPromises = sanitizedRefs.map((ref) =>
      fetchFloorWei(chainId, ref.contractAddress).catch((error) => {
        recordMetric("builder.quote.floor_error");
        console.warn("Floor fetch failed:", error);
        return 0n;
      })
    );
    const rawFloorsWei = await Promise.all(floorPromises);
    const floorsWei = rawFloorsWei.map((floor) =>
      floor < MIN_FLOOR_WEI ? MIN_FLOOR_WEI : floor
    );
    let totalFloorWei = 0n;
    for (const floor of floorsWei) {
      totalFloorWei += floor;
    }

    const expiresAt = BigInt(
      Math.floor(Date.now() / 1000) + (readEnvNumber("BUILDER_QUOTE_TTL_SEC", 300) || 300)
    );
    const nonce = randomNonce();
    const refsHash = buildRefsHash(sanitizedRefs);
    const floorsHash = buildFloorsHash(floorsWei);

    const quote = {
      totalFloorWei,
      chainId: BigInt(chainId),
      expiresAt,
      nonce,
      refsHash,
      floorsHash,
    };

    const domain = {
      name: "CubixlesBuilderMinter",
      version: "1",
      chainId,
      verifyingContract,
    };

    const types = {
      BuilderQuote: [
        { name: "refsHash", type: "bytes32" },
        { name: "floorsHash", type: "bytes32" },
        { name: "totalFloorWei", type: "uint256" },
        { name: "chainId", type: "uint256" },
        { name: "expiresAt", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const signerKey = requireEnv("CUBIXLES_BUILDER_QUOTE_SIGNER_KEY");
    const signer = new Wallet(signerKey);
    const signature = await signer.signTypedData(domain, types, {
      refsHash: quote.refsHash,
      floorsHash: quote.floorsHash,
      totalFloorWei: quote.totalFloorWei,
      chainId: quote.chainId,
      expiresAt: quote.expiresAt,
      nonce: quote.nonce,
    });

    const mintPriceWei = BASE_MINT_PRICE_WEI + (totalFloorWei * PRICE_BPS) / BPS;

    logRequest({ route: "/api/builder/quote", status: 200, requestId, bodySize });
    return NextResponse.json({
      requestId,
      verifyingContract,
      floorsWei: floorsWei.map((floor) => floor.toString()),
      totalFloorWei: totalFloorWei.toString(),
      mintPriceWei: mintPriceWei.toString(),
      quote: {
        totalFloorWei: quote.totalFloorWei.toString(),
        chainId: chainId,
        expiresAt: quote.expiresAt.toString(),
        nonce: quote.nonce.toString(),
      },
      signature,
    });
  } catch (error) {
    recordMetric("builder.quote.error");
    const message = error instanceof Error ? error.message : "Failed to generate quote.";
    logRequest({ route: "/api/builder/quote", status: 500, requestId, bodySize });
    return NextResponse.json(
      { error: message, requestId },
      { status: 500 }
    );
  }
}
