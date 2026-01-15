const MANIFEST_URL = "/assets/generative_plot/manifest.json";
const FALLBACK_PALETTE = ["#FFEAD3", "#EA7B7B", "#D25353", "#9E3B3B"];
const REQUIRED_COLORS = 4;
const INK_DARK = "#000000";
const INK_LIGHT = "#FFFFFF";

let manifestPromise = null;

function normalizeHex(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^[0-9A-F]{6}$/.test(trimmed)) {
    return `#${trimmed}`;
  }
  return null;
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function getLuminance({ r, g, b }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pickInkColor(rgb) {
  return getLuminance(rgb) > 150 ? INK_DARK : INK_LIGHT;
}

function toRgbString({ r, g, b }) {
  return `${r}, ${g}, ${b}`;
}

async function loadManifest() {
  if (manifestPromise) {
    return manifestPromise;
  }
  manifestPromise = fetch(MANIFEST_URL, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Palette manifest fetch failed (${response.status}).`);
      }
      return response.json();
    })
    .then((payload) => (Array.isArray(payload) ? payload : []))
    .catch(() => []);
  return manifestPromise;
}

function buildPaletteFromEntry(entry) {
  const colors = Array.isArray(entry?.hex_colors)
    ? entry.hex_colors
    : Array.isArray(entry?.used_hex_colors)
      ? entry.used_hex_colors
      : [];
  const normalized = colors.map(normalizeHex).filter(Boolean);
  const fallback = FALLBACK_PALETTE.map(normalizeHex).filter(Boolean);
  const output = normalized.slice(0, REQUIRED_COLORS);
  while (output.length < REQUIRED_COLORS && fallback.length) {
    output.push(fallback[output.length % fallback.length]);
  }
  return output.length === REQUIRED_COLORS ? output : FALLBACK_PALETTE.slice(0, REQUIRED_COLORS);
}

function applyPalette(palette) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  palette.forEach((hex, index) => {
    const rgb = hexToRgb(hex);
    const slot = index + 1;
    root.style.setProperty(`--palette-${slot}`, hex);
    root.style.setProperty(`--palette-${slot}-rgb`, toRgbString(rgb));
    root.style.setProperty(`--palette-${slot}-ink`, pickInkColor(rgb));
  });
}

export async function initPaletteTheme() {
  if (typeof document === "undefined") {
    return;
  }
  if (window.__CUBIXLES_PALETTE_READY__) {
    return;
  }
  window.__CUBIXLES_PALETTE_READY__ = true;
  const manifest = await loadManifest();
  if (!manifest.length) {
    applyPalette(FALLBACK_PALETTE);
    return;
  }
  const entry = manifest[Math.floor(Math.random() * manifest.length)];
  const palette = buildPaletteFromEntry(entry);
  applyPalette(palette);
}
