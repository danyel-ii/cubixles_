"use client";

import { useEffect } from "react";

import { withBasePath } from "../_lib/basePath";

type PaletteManifestEntry = {
  palette_id?: string;
  hex_colors?: string[];
  used_hex_colors?: string[];
};

const DEFAULT_PALETTE = {
  id: "EA7B7BD253539E3B3BFFEAD3",
  colors: ["#EA7B7B", "#D25353", "#9E3B3B", "#FFEAD3"],
};
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const NEUTRAL_HEX = new Set([BLACK, WHITE]);

function normalizeHex(value: string) {
  const trimmed = value.trim().replace("#", "").toUpperCase();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length === 3) {
    return `#${trimmed
      .split("")
      .map((channel) => `${channel}${channel}`)
      .join("")}`;
  }
  if (trimmed.length >= 6) {
    return `#${trimmed.slice(0, 6)}`;
  }
  return `#${trimmed.padEnd(6, "0")}`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).replace("#", "");
  const value = normalized.padEnd(6, "0");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return { r, g, b };
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(a: string, b: string) {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickOnColor(background: string) {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE)
    ? BLACK
    : WHITE;
}

function pickPaletteColors(entry: PaletteManifestEntry) {
  const raw = entry.hex_colors?.length
    ? entry.hex_colors
    : entry.used_hex_colors ?? [];
  const normalized = raw.map((value) => normalizeHex(value)).filter(Boolean);
  const unique = Array.from(new Set(normalized));
  const paletteColors = unique.filter((value) => !NEUTRAL_HEX.has(value));
  return paletteColors.length ? paletteColors : unique;
}

function ensurePaletteSize(colors: string[], size = 4) {
  if (!colors.length) {
    return [...DEFAULT_PALETTE.colors];
  }
  const resolved = [...colors];
  let index = 0;
  while (resolved.length < size) {
    resolved.push(resolved[index % resolved.length]);
    index += 1;
  }
  return resolved.slice(0, size);
}

function pickRandomPalette(entries: PaletteManifestEntry[]) {
  if (!entries.length) {
    return { paletteId: DEFAULT_PALETTE.id, colors: [...DEFAULT_PALETTE.colors] };
  }
  const entry = entries[Math.floor(Math.random() * entries.length)];
  const colors = ensurePaletteSize(pickPaletteColors(entry));
  if (!colors.length) {
    return { paletteId: DEFAULT_PALETTE.id, colors: [...DEFAULT_PALETTE.colors] };
  }
  return { paletteId: entry.palette_id ?? DEFAULT_PALETTE.id, colors };
}

export default function PaletteRandomizer() {
  useEffect(() => {
    let cancelled = false;

    const applyPalette = (palette: { paletteId: string; colors: string[] }) => {
      if (cancelled) {
        return;
      }
      const containers = Array.from(
        document.querySelectorAll<HTMLElement>(".landing-home, .token-page-neo")
      );
      if (!containers.length) {
        return;
      }

      const colors = palette.colors;
      const sortedByLuminance = [...colors].sort(
        (a, b) => relativeLuminance(a) - relativeLuminance(b)
      );
      const bg = sortedByLuminance[sortedByLuminance.length - 1];
      const surface =
        sortedByLuminance.length > 1
          ? sortedByLuminance[sortedByLuminance.length - 2]
          : bg;
      const gridCandidates = colors.filter((color) => color !== bg);
      const gridSource = gridCandidates.length ? gridCandidates : colors;
      const grid = gridSource.reduce((closest, next) => {
        const currentDelta = Math.abs(
          relativeLuminance(closest) - relativeLuminance(bg)
        );
        const nextDelta = Math.abs(relativeLuminance(next) - relativeLuminance(bg));
        return nextDelta < currentDelta ? next : closest;
      });

      const primary = colors[0] ?? bg;
      const secondary = colors[1] ?? primary;
      const accent = colors[2] ?? secondary;
      const mint = colors[3] ?? accent;

      const text = (() => {
        const blackScore = Math.min(
          contrastRatio(bg, BLACK),
          contrastRatio(surface, BLACK)
        );
        const whiteScore = Math.min(
          contrastRatio(bg, WHITE),
          contrastRatio(surface, WHITE)
        );
        return blackScore >= whiteScore ? BLACK : WHITE;
      })();

      const border = text;
      const muted = text;
      const onSurface = pickOnColor(surface);
      const onPrimary = pickOnColor(primary);
      const onSecondary = pickOnColor(secondary);
      const onAccent = pickOnColor(accent);
      const onMint = pickOnColor(mint);

      containers.forEach((container) => {
        container.style.setProperty("--neo-bg", bg);
        container.style.setProperty("--neo-surface", surface);
        container.style.setProperty("--neo-border", border);
        container.style.setProperty("--neo-text", text);
        container.style.setProperty("--neo-muted", muted);
        container.style.setProperty("--neo-primary", primary);
        container.style.setProperty("--neo-secondary", secondary);
        container.style.setProperty("--neo-accent", accent);
        container.style.setProperty("--neo-mint", mint);
        container.style.setProperty("--neo-grid", grid);
        container.style.setProperty("--neo-on-surface", onSurface);
        container.style.setProperty("--neo-on-primary", onPrimary);
        container.style.setProperty("--neo-on-secondary", onSecondary);
        container.style.setProperty("--neo-on-accent", onAccent);
        container.style.setProperty("--neo-on-mint", onMint);
        container.dataset.paletteId = palette.paletteId;
      });
    };

    const loadPalette = async () => {
      try {
        const response = await fetch(withBasePath("/palette_outputs/manifest.json"));
        if (!response.ok) {
          applyPalette({
            paletteId: DEFAULT_PALETTE.id,
            colors: [...DEFAULT_PALETTE.colors],
          });
          return;
        }
        const entries = (await response.json()) as PaletteManifestEntry[];
        applyPalette(pickRandomPalette(entries));
      } catch {
        applyPalette({
          paletteId: DEFAULT_PALETTE.id,
          colors: [...DEFAULT_PALETTE.colors],
        });
      }
    };

    loadPalette();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
