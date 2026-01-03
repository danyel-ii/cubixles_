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

function buildNonceMessage(nonce) {
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

export async function pinTokenMetadata({ metadata, signer, address }) {
  if (!signer || !address) {
    throw new Error("Wallet signer unavailable.");
  }
  const nonce = await fetchNonce();
  const signature = await signer.signMessage(buildNonceMessage(nonce));

  const response = await fetch("/api/pin/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      nonce,
      signature,
      payload: metadata,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Pinning failed (${response.status})`);
  }
  const json = await response.json();
  if (!json?.tokenURI) {
    throw new Error("Pinning failed to return a token URI.");
  }
  return json.tokenURI;
}
