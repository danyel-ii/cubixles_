import { readEnvValue } from "../shared/utils/env.js";

export function getGifLibraryCid() {
  return (
    readEnvValue("NEXT_PUBLIC_GIF_LIBRARY_CID") ??
    "QmQJF5H31a6HFpmce6ksehw9wLQai7tTzdi7yweQ3Q97Mj"
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
    if (process.env.NODE_ENV !== "production") {
      return window.location.origin;
    }
  }
  return "";
}

export function getPaletteImagesCid() {
  return readEnvValue("NEXT_PUBLIC_PALETTE_IMAGES_CID");
}

export function getPaletteManifestCid() {
  return readEnvValue("NEXT_PUBLIC_PALETTE_MANIFEST_CID");
}

export function getAnimationUrl() {
  return readEnvValue("NEXT_PUBLIC_ANIMATION_URL");
}

export function buildTokenViewUrl(tokenId) {
  const base = getTokenViewBaseUrl();
  if (!base) {
    return "";
  }
  return `${base}/m/${tokenId}`;
}

export function buildPalettePreviewGifUrl() {
  const base = getTokenViewBaseUrl();
  if (!base) {
    return "";
  }
  return `${base}/assets/palette_cycle_512.gif`;
}
