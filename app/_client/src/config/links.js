import { readEnvValue } from "../shared/utils/env.js";

export function getGifLibraryCid() {
  return (
    readEnvValue("NEXT_PUBLIC_GIF_LIBRARY_CID") ??
    "bafybeiap5a6tm3kpiizbjscfh5cafj245jjuchvfumz2azwyvs3y3ybvpy"
  );
}

export function getTokenViewBaseUrl() {
  const explicit = readEnvValue("NEXT_PUBLIC_TOKEN_VIEW_BASE_URL");
  if (explicit) {
    const trimmed = explicit.trim();
    const normalized = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return normalized.replace(/\/$/, "");
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
