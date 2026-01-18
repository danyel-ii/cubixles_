import { CUBIXLES_CONTRACT } from "../../config/contracts";

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

function parseNonce(nonce) {
  if (!nonce || typeof nonce !== "string") {
    return { ok: false };
  }
  const parts = nonce.split(".");
  if (parts.length !== 4) {
    return { ok: false };
  }
  const [, issuedAtRaw, ttlRaw] = parts;
  const issuedAt = Number(issuedAtRaw);
  const ttlMs = Number(ttlRaw);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(ttlMs)) {
    return { ok: false };
  }
  return { ok: true, issuedAt, ttlMs };
}

function buildPinTypedData(nonce, chainId) {
  const parsed = parseNonce(nonce);
  if (!parsed.ok) {
    throw new Error("Invalid nonce format.");
  }
  const issuedAt = parsed.issuedAt;
  const expiresAt = parsed.issuedAt + parsed.ttlMs;
  return {
    domain: {
      name: PIN_DOMAIN_NAME,
      version: PIN_DOMAIN_VERSION,
      chainId,
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

async function fetchNonce() {
  const response = await fetch("/api/nonce", { method: "GET" });
  if (!response.ok) {
    throw new Error(`Nonce request failed (${response.status}).`);
  }
  const json = await response.json();
  if (!json?.nonce) {
    throw new Error("Nonce response missing nonce.");
  }
  return json.nonce;
}

async function signPinRequest({ signer, chainId }) {
  const nonce = await fetchNonce();
  const { domain, types, value } = buildPinTypedData(nonce, chainId);
  const signature = await signer.signTypedData(domain, types, value);
  return { nonce, signature };
}

export async function pinTokenMetadata({
  metadata,
  signer,
  address,
  chainId = CUBIXLES_CONTRACT.chainId,
}) {
  if (!signer || !address) {
    throw new Error("Wallet signer unavailable.");
  }
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { nonce, signature } = await signPinRequest({ signer, chainId });

    const response = await fetch("/api/pin/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        nonce,
        signature,
        chainId,
        payload: metadata,
      }),
    });
    if (response.ok) {
      const json = await response.json();
      if (!json?.tokenURI || !json?.metadataHash) {
        throw new Error("Pinning failed to return metadata details.");
      }
      return {
        tokenURI: json.tokenURI,
        metadataHash: json.metadataHash,
      };
    }
    const text = await response.text();
    lastError = text || `Pinning failed (${response.status})`;
    if (!/nonce already used/i.test(lastError)) {
      break;
    }
  }
  throw new Error(lastError || "Pinning failed.");
}

export async function pinBuilderAssets({
  viewerUrl,
  tokenId,
  signer,
  address,
  paperclip,
  chainId = CUBIXLES_CONTRACT.chainId,
}) {
  if (!signer || !address) {
    throw new Error("Wallet signer unavailable.");
  }
  if (!viewerUrl) {
    throw new Error("Viewer URL missing.");
  }
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { nonce, signature } = await signPinRequest({ signer, chainId });
    const response = await fetch("/api/pin/builder-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        nonce,
        signature,
        chainId,
        payload: {
          viewerUrl,
          tokenId,
          paperclip,
        },
      }),
    });
    if (response.ok) {
      const json = await response.json();
      if (!json?.qrUrl || !json?.cardUrl) {
        throw new Error("Pinning failed to return asset URLs.");
      }
      if (paperclip && !json?.paperclipUrl) {
        throw new Error("Pinning failed to return paperclip URL.");
      }
      return json;
    }
    const text = await response.text();
    lastError = text || `Pinning failed (${response.status})`;
    if (!/nonce already used/i.test(lastError)) {
      break;
    }
  }
  throw new Error(lastError || "Pinning failed.");
}
