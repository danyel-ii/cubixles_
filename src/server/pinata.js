import crypto from "crypto";
import { requireEnv } from "./env.js";
import { getCache, setCache } from "./cache.js";

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_FILE_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_APP_TAG = "cubixles_";

const DEDUPE_TTL_MS = 10 * 60 * 1000;

function nowMs() {
  return Date.now();
}

export function hashPayload(payload) {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function getCachedCid(hash) {
  return await getCache(`pinata:${hash}`);
}

export async function setCachedCid(hash, cid) {
  await setCache(`pinata:${hash}`, cid, DEDUPE_TTL_MS);
}

function normalizeKeyvalues(values) {
  if (!values || typeof values !== "object") {
    return null;
  }
  const normalized = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) {
      continue;
    }
    normalized[key] = String(value);
  }
  return Object.keys(normalized).length ? normalized : null;
}

function buildPinataMetadata({ name, keyvalues } = {}) {
  const normalizedKeyvalues = normalizeKeyvalues(keyvalues);
  if (!name && !normalizedKeyvalues) {
    return undefined;
  }
  const metadata = {};
  if (name && typeof name === "string") {
    metadata.name = name;
  }
  if (normalizedKeyvalues) {
    metadata.keyvalues = normalizedKeyvalues;
  }
  return metadata;
}

export async function pinJson(payload, { name, keyvalues } = {}) {
  const jwt = requireEnv("PINATA_JWT");
  const pinataMetadata = buildPinataMetadata({
    name,
    keyvalues: { app: PINATA_APP_TAG, ...keyvalues },
  });
  const response = await fetch(PINATA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: JSON.parse(payload),
      pinataMetadata,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || "Pinata error");
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return data?.IpfsHash ?? null;
}

export async function pinFile(
  buffer,
  { name, mimeType = "image/gif", keyvalues } = {}
) {
  const jwt = requireEnv("PINATA_JWT");
  const form = new FormData();
  const fileName = name || "cubixles.gif";
  const blob = new Blob([buffer], { type: mimeType });
  form.append("file", blob, fileName);
  const pinataMetadata = buildPinataMetadata({
    name,
    keyvalues: { app: PINATA_APP_TAG, ...keyvalues },
  });
  if (pinataMetadata) {
    form.append("pinataMetadata", JSON.stringify(pinataMetadata));
  }
  const response = await fetch(PINATA_FILE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || "Pinata file error");
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return data?.IpfsHash ?? null;
}
