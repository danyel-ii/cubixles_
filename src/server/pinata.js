import crypto from "crypto";
import { requireEnv } from "./env.js";
import { getCache, setCache } from "./cache.js";

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_FILE_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";

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

export async function pinJson(payload, { name } = {}) {
  const jwt = requireEnv("PINATA_JWT");
  const groupId = requireEnv("PINATA_GROUP_ID");
  const pinataMetadata = name && typeof name === "string" ? { name } : undefined;
  const response = await fetch(PINATA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: JSON.parse(payload),
      pinataMetadata,
      pinataOptions: { groupId },
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

export async function pinFile(buffer, { name, mimeType = "image/gif" } = {}) {
  const jwt = requireEnv("PINATA_JWT");
  const groupId = requireEnv("PINATA_GROUP_ID");
  const form = new FormData();
  const fileName = name || "cubixles.gif";
  const blob = new Blob([buffer], { type: mimeType });
  form.append("file", blob, fileName);
  if (name) {
    form.append("pinataMetadata", JSON.stringify({ name }));
  }
  form.append("pinataOptions", JSON.stringify({ groupId }));
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
