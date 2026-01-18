import { getWalletState, subscribeWallet } from "../wallet/wallet.js";
import { renderCubesPaperClip } from "./cubes-paperclip.js";
import {
  loadPaperclipOverlay,
  resolvePaperclipPalette,
  resolvePaperclipQrText,
} from "./paperclip-utils.js";

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

  let renderToken = 0;

  async function renderIfReady() {
    const token = (renderToken += 1);
    const address = walletState?.address || "";
    if (!address) {
      setStatus("Connect your wallet to render the sculpture.");
      return;
    }
    const palette = resolvePaperclipPalette();
    const qrText = resolvePaperclipQrText();
    const paletteLabel = palette.length
      ? `${palette.length} sheets`
      : "Palette unavailable";
    setStatus(`Seeded by ${truncateMiddle(address)} · ${paletteLabel}`);
    const overlay = await loadPaperclipOverlay();
    if (token !== renderToken) {
      return;
    }
    renderCubesPaperClip({
      canvas,
      seed: address.toLowerCase(),
      palette,
      overlay,
      qrText,
    });
  }

  function openPanel() {
    panel.classList.remove("is-hidden");
    isOpen = true;
    void renderIfReady();
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
      void renderIfReady();
    }
  });

  subscribeWallet((next) => {
    walletState = next;
    if (isOpen) {
      void renderIfReady();
    }
  });
}
