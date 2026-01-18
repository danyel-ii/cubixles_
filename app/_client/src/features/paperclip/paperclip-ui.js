import { getStoredPalette } from "../../ui/palette-theme.js";
import { getWalletState, subscribeWallet } from "../wallet/wallet.js";
import { renderCubesPaperClip } from "./cubes-paperclip.js";

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

function resolvePalette() {
  const stored = getStoredPalette();
  if (stored?.length) {
    return stored.map(normalizeHex).filter(Boolean);
  }
  if (typeof window !== "undefined" && Array.isArray(window.__CUBIXLES_PALETTE__)) {
    return window.__CUBIXLES_PALETTE__.map(normalizeHex).filter(Boolean);
  }
  return readPaletteFromCss();
}

function truncateMiddle(value, start = 6, end = 4) {
  if (!value || value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function initPaperClipUi() {
  const openButton = document.getElementById("paperclip-open");
  const panel = document.getElementById("paperclip-panel");
  const closeButton = document.getElementById("paperclip-close");
  const canvas = document.getElementById("paperclip-canvas");
  const statusEl = document.getElementById("paperclip-status");
  if (!openButton || !panel || !closeButton || !canvas || !statusEl) {
    return;
  }

  let walletState = getWalletState();
  let isOpen = false;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function renderIfReady() {
    const address = walletState?.address || "";
    if (!address) {
      setStatus("Connect your wallet to render the sculpture.");
      return;
    }
    const palette = resolvePalette();
    const paletteLabel = palette.length
      ? `${palette.length} sheets`
      : "Palette unavailable";
    setStatus(`Seeded by ${truncateMiddle(address)} · ${paletteLabel}`);
    renderCubesPaperClip({
      canvas,
      seed: address.toLowerCase(),
      palette,
    });
  }

  function openPanel() {
    panel.classList.remove("is-hidden");
    isOpen = true;
    renderIfReady();
  }

  function closePanel() {
    panel.classList.add("is-hidden");
    isOpen = false;
  }

  openButton.addEventListener("click", (event) => {
    event.preventDefault();
    openPanel();
  });

  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    closePanel();
  });

  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.hasAttribute("data-paperclip-close")) {
      closePanel();
    }
  });

  window.addEventListener("resize", () => {
    if (isOpen) {
      renderIfReady();
    }
  });

  subscribeWallet((next) => {
    walletState = next;
    if (isOpen) {
      renderIfReady();
    }
  });
}
