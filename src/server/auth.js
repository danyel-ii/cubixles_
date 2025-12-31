import crypto from "crypto";
import {
  Contract,
  JsonRpcProvider,
  getAddress,
  hashMessage,
  toUtf8Bytes,
  verifyMessage,
} from "ethers";
import { requireEnv } from "./env.js";
import { getRedis } from "./redis.js";
import { recordMetric } from "./metrics.js";

const NONCE_TTL_MS = 5 * 60 * 1000;
const usedNonces = new Map();
const EIP1271_MAGIC = "0x1626ba7e";
const EIP1271_ABI = [
  "function isValidSignature(bytes32,bytes) view returns (bytes4)",
  "function isValidSignature(bytes,bytes) view returns (bytes4)",
];

function nowMs() {
  return Date.now();
}

function hmacFor(value) {
  const secret = requireEnv("SERVER_AUTH_SALT");
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function cleanupNonces() {
  const cutoff = nowMs() - NONCE_TTL_MS;
  for (const [nonce, issuedAt] of usedNonces) {
    if (issuedAt < cutoff) {
      usedNonces.delete(nonce);
    }
  }
}

function parseNonce(nonce) {
  if (!nonce || typeof nonce !== "string") {
    return { ok: false, error: "Missing nonce" };
  }
  const parts = nonce.split(".");
  if (parts.length !== 4) {
    return { ok: false, error: "Invalid nonce format" };
  }
  const [rand, issuedAtRaw, ttlRaw, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  const ttlMs = Number(ttlRaw);
  if (!rand || !Number.isFinite(issuedAt) || !Number.isFinite(ttlMs)) {
    return { ok: false, error: "Invalid nonce values" };
  }
  return { ok: true, rand, issuedAt, ttlMs, signature };
}

export function buildNonceMessage(nonce) {
  const parsed = parseNonce(nonce);
  const issuedAt = parsed.ok ? new Date(parsed.issuedAt).toISOString() : "unknown";
  const expiresAt = parsed.ok
    ? new Date(parsed.issuedAt + parsed.ttlMs).toISOString()
    : "unknown";
  return [
    "cubixles_ wants you to sign this message to authorize metadata pinning.",
    "No transaction or gas is required.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expires At: ${expiresAt}`,
  ].join("\n");
}

export function issueNonce() {
  const issuedAt = nowMs();
  const ttlMs = NONCE_TTL_MS;
  const rand = crypto.randomBytes(16).toString("hex");
  const payload = `${rand}.${issuedAt}.${ttlMs}`;
  const signature = hmacFor(payload);
  const nonce = `${payload}.${signature}`;
  return { nonce, expiresAt: issuedAt + ttlMs };
}

async function markNonceUsed(nonce, ttlMs, issuedAt) {
  const redis = getRedis();
  if (redis) {
    const result = await redis.set(`nonce:${nonce}`, "1", { nx: true, px: ttlMs });
    if (!result) {
      return { ok: false, error: "Nonce already used" };
    }
    return { ok: true };
  }

  cleanupNonces();
  if (usedNonces.has(nonce)) {
    return { ok: false, error: "Nonce already used" };
  }
  usedNonces.set(nonce, issuedAt);
  return { ok: true };
}

export async function verifyNonce(nonce) {
  const parsed = parseNonce(nonce);
  if (!parsed.ok) {
    recordMetric("auth.nonce.invalid");
    return { ok: false, error: parsed.error };
  }
  const { rand, issuedAt, ttlMs, signature } = parsed;
  const payload = `${rand}.${issuedAt}.${ttlMs}`;
  const expected = hmacFor(payload);
  if (signature !== expected) {
    recordMetric("auth.nonce.invalid");
    return { ok: false, error: "Invalid nonce signature" };
  }
  const expiresAt = issuedAt + ttlMs;
  if (nowMs() > expiresAt) {
    recordMetric("auth.nonce.expired");
    return { ok: false, error: "Nonce expired" };
  }
  const mark = await markNonceUsed(nonce, ttlMs, issuedAt);
  if (!mark.ok) {
    recordMetric("auth.nonce.replay");
    return mark;
  }
  return { ok: true, expiresAt };
}

function getRpcUrl() {
  const chainId = Number(process.env.ICECUBE_CHAIN_ID || 1);
  if (chainId === 11155111) {
    return process.env.SEPOLIA_RPC_URL || null;
  }
  if (chainId === 1) {
    return process.env.MAINNET_RPC_URL || null;
  }
  return process.env.MAINNET_RPC_URL || null;
}

async function verifyContractSignature(checksum, message, signature) {
  const rpcUrl = getRpcUrl();
  if (!rpcUrl) {
    return false;
  }
  const provider = new JsonRpcProvider(rpcUrl);
  const code = await provider.getCode(checksum);
  if (!code || code === "0x") {
    return false;
  }

  const contract = new Contract(checksum, EIP1271_ABI, provider);
  const messageHash = hashMessage(message);
  try {
    const result = await contract["isValidSignature(bytes32,bytes)"](messageHash, signature);
    if (result?.toLowerCase?.() === EIP1271_MAGIC) {
      return true;
    }
  } catch (error) {
    // fall through to bytes signature
  }

  try {
    const result = await contract["isValidSignature(bytes,bytes)"](toUtf8Bytes(message), signature);
    return result?.toLowerCase?.() === EIP1271_MAGIC;
  } catch (error) {
    return false;
  }
}

export async function verifySignature({ address, nonce, signature }) {
  if (!address || !signature) {
    recordMetric("auth.signature.missing");
    return { ok: false, error: "Missing address or signature" };
  }
  let checksum;
  try {
    checksum = getAddress(address);
  } catch (error) {
    recordMetric("auth.signature.invalid_address");
    return { ok: false, error: "Invalid address" };
  }
  const message = buildNonceMessage(nonce);
  let recovered;
  try {
    recovered = verifyMessage(message, signature);
  } catch (error) {
    recovered = null;
  }
  if (recovered && getAddress(recovered) === checksum) {
    return { ok: true, address: checksum };
  }

  const valid1271 = await verifyContractSignature(checksum, message, signature);
  if (!valid1271) {
    recordMetric("auth.signature.mismatch");
    return { ok: false, error: "Signature mismatch" };
  }
  return { ok: true, address: checksum };
}
