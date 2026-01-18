const FALLBACK_PALETTE = ["#D40000", "#FFCC00", "#111111"];
export const DEFAULT_PAPERCLIP_SIZE = 1024;
export const PAPERCLIP_SCALE = 0.78;

function normalizeHex(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : null;
}

export function normalizePaperclipPalette(palette) {
  if (!Array.isArray(palette)) {
    return [];
  }
  return palette.map(normalizeHex).filter(Boolean);
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createPaperclipRng(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildPaperclipLayers({ seed, palette } = {}) {
  const paletteList = normalizePaperclipPalette(palette);
  const colors = paletteList.length ? paletteList : FALLBACK_PALETTE;
  const layerCount = Math.max(1, colors.length);
  const baseSeed = hashString(seed || "cubixles");
  const baseRng = createPaperclipRng(baseSeed);
  const layers = [];

  for (let i = 0; i < layerCount; i += 1) {
    const depth = layerCount <= 1 ? 0 : i / (layerCount - 1);
    const layerSeed = Math.floor(baseRng() * 1e9) + i * 97;
    const prng = createPaperclipRng(layerSeed);
    const grid = Math.floor(8 + prng() * 12);
    const holeProbability = 0.55 + prng() * 0.35;
    const radiusFactor = 0.32 + prng() * 0.32;
    const squareMix = prng() * 0.65;
    layers.push({
      index: i,
      layerSeed,
      color: colors[i % colors.length],
      grid,
      holeProbability,
      radiusFactor,
      squareMix,
      rotation: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      shadowBlur: 12 + depth * 12,
      shadowOffsetY: 6 + depth * 6,
    });
  }

  return { colors, layers };
}

export function buildPaperclipSpec({
  seed,
  palette,
  size = DEFAULT_PAPERCLIP_SIZE,
} = {}) {
  const { colors, layers } = buildPaperclipLayers({ seed, palette });
  return {
    seed: seed || "cubixles",
    size,
    scale: PAPERCLIP_SCALE,
    paletteHex: colors,
    layers,
  };
}
