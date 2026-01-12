import crypto from "crypto";
import {
  Contract,
  JsonRpcProvider,
  getAddress,
  TypedDataEncoder,
  verifyTypedData,
} from "ethers";
import { requireEnv } from "./env.js";
import { buildRedisKey, getRedis } from "./redis.js";
import { recordMetric } from "./metrics.js";

const NONCE_TTL_MS = 5 * 60 * 1000;
const usedNonces = new Map();
const EIP1271_MAGIC = "0x1626ba7e";
const PIN_DOMAIN_NAME = "cubixles_";
const PIN_DOMAIN_VERSION = "1";
const PIN_STATEMENT = "cubixles_ wants you to authorize metadata pinning.";
const PIN_TYPES = {
  MetadataPin: [
    { name: "statement", type: "string" },
    { name: "nonce", type: "string" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
};
const EIP1271_ABI = [
  "function isValidSignature(bytes32,bytes) view returns (bytes4)",
  "function isValidSignature(bytes,bytes) view returns (bytes4)",
];
const SUPPORTED_CHAIN_IDS = new Set([1, 8453, 11155111]);

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

function getAuthChainId() {
  const chainId = Number(process.env.CUBIXLES_CHAIN_ID || 1);
  if (!Number.isFinite(chainId)) {
    return 1;
  }
  return SUPPORTED_CHAIN_IDS.has(chainId) ? chainId : 1;
}

function resolveAuthChainId(chainId) {
  const parsed = Number(chainId);
  if (Number.isFinite(parsed) && SUPPORTED_CHAIN_IDS.has(parsed)) {
    return parsed;
  }
  return getAuthChainId();
}

function buildPinTypedData(nonce, chainId) {
  const parsed = parseNonce(nonce);
  if (!parsed.ok) {
    return parsed;
  }
  const issuedAt = parsed.issuedAt;
  const expiresAt = parsed.issuedAt + parsed.ttlMs;
  return {
    ok: true,
    domain: {
      name: PIN_DOMAIN_NAME,
      version: PIN_DOMAIN_VERSION,
      chainId: resolveAuthChainId(chainId),
    },
    types: PIN_TYPES,
    value: {
      statement: PIN_STATEMENT,
      nonce,
      issuedAt,
      expiresAt,
    },
  };
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
    const result = await redis.set(buildRedisKey(`nonce:${nonce}`), "1", { nx: true, px: ttlMs });
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

export function resolveRpcUrlForChain(chainId) {
  if (chainId === 11155111) {
    return process.env.SEPOLIA_RPC_URL || null;
  }
  if (chainId === 8453) {
    return process.env.BASE_RPC_URL || null;
  }
  if (chainId === 1) {
    return process.env.MAINNET_RPC_URL || null;
  }
  return null;
}

function getRpcUrl() {
  return resolveRpcUrlForChain(getAuthChainId());
}

async function callSignatureMethod(contract, method, args) {
  try {
    return await contract[method](...args);
  } catch {
    return null;
  }
}

async function verifyContractSignature(checksum, domain, types, value, signature, chainId) {
  const rpcUrl = resolveRpcUrlForChain(resolveAuthChainId(chainId));
  if (!rpcUrl) {
    return false;
  }
  const provider = new JsonRpcProvider(rpcUrl);
  const code = await provider.getCode(checksum);
  if (!code || code === "0x") {
    return false;
  }

  const contract = new Contract(checksum, EIP1271_ABI, provider);
  const digest = TypedDataEncoder.hash(domain, types, value);
  const encoded = TypedDataEncoder.encode(domain, types, value);
  const checks = [
    ["isValidSignature(bytes32,bytes)", [digest, signature]],
    ["isValidSignature(bytes,bytes)", [encoded, signature]],
  ];
  for (const [method, args] of checks) {
    const result = await callSignatureMethod(contract, method, args);
    if (result?.toLowerCase?.() === EIP1271_MAGIC) {
      return true;
    }
  }
  return false;
}

export async function verifySignature({ address, nonce, signature, chainId }) {
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
  const typedData = buildPinTypedData(nonce, chainId);
  if (!typedData.ok) {
    recordMetric("auth.signature.invalid_nonce");
    return { ok: false, error: typedData.error || "Invalid nonce" };
  }
  const { domain, types, value } = typedData;
  let recovered;
  try {
    recovered = verifyTypedData(domain, types, value, signature);
  } catch (error) {
    recovered = null;
  }
  if (recovered && getAddress(recovered) === checksum) {
    return { ok: true, address: checksum };
  }

  const valid1271 = await verifyContractSignature(
    checksum,
    domain,
    types,
    value,
    signature,
    chainId
  );
  if (!valid1271) {
    recordMetric("auth.signature.mismatch");
    return { ok: false, error: "Signature mismatch" };
  }
  return { ok: true, address: checksum };
}
