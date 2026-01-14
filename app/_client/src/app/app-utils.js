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
  for (let y = 0; y < size; y += 1) {
    const t = y / Math.max(1, size - 1);
    const band =
      Math.exp(-Math.pow((t - 0.25) / 0.08, 2)) * 70 +
      Math.exp(-Math.pow((t - 0.62) / 0.12, 2)) * 55;
    const ripple = Math.sin(t * Math.PI * 6 + 0.35) * 14;
    const edgeFade = -35 * Math.abs(t - 0.5);
    const value = Math.max(0, Math.min(255, 155 + band + ripple + edgeFade));
    g.stroke(value, Math.min(255, value + 8), Math.min(255, value + 16));
    g.line(0, y, size, y);
  }
  g.stroke(255, 255, 255, 40);
  for (let i = -size; i < size * 2; i += 14) {
    g.line(i, 0, i + size, size);
  }
  g.stroke(255, 255, 255, 18);
  for (let i = -size; i < size * 2; i += 22) {
    g.line(i, size, i + size, 0);
  }
  g.stroke(255, 255, 255, 22);
  for (let i = 0; i < size * 2; i += 1) {
    g.point(Math.random() * size, Math.random() * size);
  }
  return g;
}
