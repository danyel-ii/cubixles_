import { config } from "./app-config.js";

export function resolveUrl(url) {
  if (url.startsWith("ipfs://")) {
    return `${config.ipfsGateway}${url.replace("ipfs://", "")}`;
  }
  return url;
}

export function fillFaceTextures(sourceTextures) {
  const filled = [];
  for (let i = 0; i < 6; i += 1) {
    filled.push(sourceTextures[i % sourceTextures.length]);
  }
  return filled;
}

export function fillFaceDataUrls(sourceUrls) {
  const filled = [];
  for (let i = 0; i < 6; i += 1) {
    filled.push(sourceUrls[i % sourceUrls.length]);
  }
  return filled;
}
