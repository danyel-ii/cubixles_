function readEnvValue(key) {
  const raw = typeof process !== "undefined" ? process.env[key] : undefined;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function getGifLibraryCid() {
  return (
    readEnvValue("NEXT_PUBLIC_GIF_LIBRARY_CID") ??
    "bafybeidr5grosbcwqg6hghnippmu4jgho2wc7n6g42aunityr5ee3u6xru"
  );
}

export function getTokenViewBaseUrl() {
  const explicit = readEnvValue("NEXT_PUBLIC_TOKEN_VIEW_BASE_URL");
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function buildTokenViewUrl(tokenId) {
  const base = getTokenViewBaseUrl();
  if (!base) {
    return "";
  }
  return `${base}/m/${tokenId}`;
}
