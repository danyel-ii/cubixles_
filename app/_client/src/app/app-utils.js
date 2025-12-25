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

export function mapSelectionToFaceTextures(selectionTextures, fallbackTexture) {
  const faces = [];
  for (let i = 0; i < 6; i += 1) {
    faces.push(selectionTextures[i] || fallbackTexture || null);
  }
  return faces;
}

export function fillFaceDataUrls(sourceUrls) {
  const filled = [];
  for (let i = 0; i < 6; i += 1) {
    filled.push(sourceUrls[i % sourceUrls.length]);
  }
  return filled;
}

export function getMaxTextureSize() {
  if (typeof window === "undefined") {
    return config.textureMaxSize.desktop;
  }
  const isMobile = window.innerWidth <= 700 || window.innerHeight <= 700;
  return isMobile ? config.textureMaxSize.mobile : config.textureMaxSize.desktop;
}

export function downscaleImageToMax(img, maxSize) {
  if (!img || !maxSize) {
    return img;
  }
  const maxDim = Math.max(img.width, img.height);
  if (maxDim <= maxSize) {
    return img;
  }
  const scale = maxSize / maxDim;
  const nextWidth = Math.max(1, Math.floor(img.width * scale));
  const nextHeight = Math.max(1, Math.floor(img.height * scale));
  img.resize(nextWidth, nextHeight);
  return img;
}

export function createFrostedTexture(size = 160) {
  const g = createGraphics(size, size);
  g.clear();
  g.noStroke();
  g.background(210, 220, 235, 28);
  for (let i = 0; i < size * 6; i += 1) {
    const alpha = 18 + (i % 25);
    g.fill(235, 240, 248, alpha);
    g.circle(Math.random() * size, Math.random() * size, 2 + (i % 4));
  }
  g.fill(255, 255, 255, 35);
  g.rect(0, 0, size, size);
  return g;
}
