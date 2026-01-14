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
  g.pixelDensity(1);
  g.clear();

  const ctx = g.drawingContext;
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#0b1016");
  base.addColorStop(0.25, "#222933");
  base.addColorStop(0.5, "#aeb7c5");
  base.addColorStop(0.7, "#5b6472");
  base.addColorStop(1, "#121821");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  noiseSeed(7);
  g.noFill();
  g.strokeWeight(1);
  const highlights = [
    { center: size * 0.22, spread: size * 0.08, strength: 90 },
    { center: size * 0.52, spread: size * 0.12, strength: 130 },
    { center: size * 0.78, spread: size * 0.1, strength: 70 },
  ];

  for (let y = 0; y < size; y += 1) {
    const t = y / Math.max(1, size - 1);
    const wave = Math.sin(t * Math.PI * 6.4 + 0.35) * 22;
    const wave2 = Math.sin(t * Math.PI * 2.2 - 0.7) * 12;
    const grain = (noise(t * 3.4, 0.7) - 0.5) * 35;
    let highlight = 0;
    highlights.forEach((spec) => {
      const dist = (y - spec.center) / spec.spread;
      highlight += Math.exp(-dist * dist) * spec.strength;
    });
    const value = Math.max(0, Math.min(255, 105 + wave + wave2 + grain + highlight));
    const cool = Math.min(255, value + 18);
    g.stroke(cool - 12, cool - 4, cool + 12, 220);
    g.line(0, y, size, y);
  }

  ctx.globalCompositeOperation = "screen";
  const radial = ctx.createRadialGradient(
    size * 0.18,
    size * 0.22,
    size * 0.05,
    size * 0.18,
    size * 0.22,
    size * 0.9
  );
  radial.addColorStop(0, "rgba(255,255,255,0.35)");
  radial.addColorStop(0.35, "rgba(255,255,255,0.12)");
  radial.addColorStop(0.65, "rgba(255,255,255,0.0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, size);

  g.stroke(255, 255, 255, 18);
  g.strokeWeight(1.1);
  for (let i = -size; i < size * 2; i += 18) {
    g.beginShape();
    for (let x = -size * 0.2; x <= size * 1.2; x += size / 10) {
      const t = x / Math.max(1, size);
      const wobble =
        Math.sin(t * Math.PI * 2 + i * 0.06) * (size * 0.05) +
        (noise(t * 1.8, i * 0.04) - 0.5) * (size * 0.08);
      g.vertex(x, i + wobble);
    }
    g.endShape();
  }

  g.stroke(255, 255, 255, 26);
  for (let i = 0; i < size * 1.6; i += 1) {
    g.point(Math.random() * size, Math.random() * size);
  }

  ctx.globalCompositeOperation = "source-over";
  return g;
}
