import { readEnvValue } from "../shared/utils/env.js";

export function getGifLibraryCid() {
  return (
    readEnvValue("NEXT_PUBLIC_GIF_LIBRARY_CID") ??
    "bafybeibwlwe5gwxwg3bjzkqtzxtjdq7tr346iwfozipl47tlpfnagzwfhi"
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
