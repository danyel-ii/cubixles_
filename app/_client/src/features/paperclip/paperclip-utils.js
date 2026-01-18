import { getStoredPalette } from "../../ui/palette-theme.js";

const MAX_PALETTE = 7;

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

function readPaletteFromCss() {
  if (typeof document === "undefined") {
    return [];
  }
  const style = window.getComputedStyle(document.documentElement);
  const colors = [];
  for (let i = 1; i <= MAX_PALETTE; i += 1) {
    const value = style.getPropertyValue(`--palette-${i}`);
    const normalized = normalizeHex(value);
    if (normalized) {
      colors.push(normalized);
    }
  }
  return colors;
}

export function resolvePaperclipPalette() {
  const stored = getStoredPalette();
  if (stored?.length) {
    return stored.map(normalizeHex).filter(Boolean);
  }
  if (typeof window !== "undefined" && Array.isArray(window.__CUBIXLES_PALETTE__)) {
    return window.__CUBIXLES_PALETTE__.map(normalizeHex).filter(Boolean);
  }
  return readPaletteFromCss();
}
