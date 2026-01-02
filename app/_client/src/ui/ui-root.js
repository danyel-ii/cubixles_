import { initOverlay } from "./panels/overlay.js";
import { initLocalTextureUi } from "./panels/local-textures.js";
import { initExportUi } from "./panels/export-ui.js";
import { initLeaderboardUi } from "./panels/leaderboard.js";
import { initPreviewUi } from "./panels/preview.js";
import { initEthHud } from "./hud/eth-hud.js";
import { initLessSupplyHud } from "./hud/less-hud.js";
import { initLessDeltaTracking } from "./hud/less-delta.js";
import { initWalletUi } from "../features/wallet/wallet-ui.js";
import { initNftPickerUi } from "../features/nft/picker-ui.js";
import { initMintUi } from "../features/mint/mint-ui.js";
import { state } from "../app/app-state.js";
import { buildTokenViewUrl } from "../config/links.js";

let uiInitialized = false;

export function initUiRoot() {
  if (uiInitialized) {
    return;
  }
  uiInitialized = true;
  initOverlay();
  initLocalTextureUi();
  initExportUi();
  initWalletUi();
  initNftPickerUi();
  initMintUi();
  initLeaderboardUi();
  initEthHud();
  initLessSupplyHud();
  initLessDeltaTracking();
  initPreviewUi();
  initMintedBanner();
  initUiTouchGuards();
  initTokenIdFromUrl();
  initLandingReturn();
  initDebugPanel();
  initShareDialog();
}

function initUiTouchGuards() {
  const selectors = ["#ui", "#leaderboard", "#preview-bar", "#overlay"];
  selectors.forEach((selector) => {
    const el = document.querySelector(selector);
    if (!el) {
      return;
    }
    ["touchstart", "touchmove", "touchend"].forEach((eventName) => {
      el.addEventListener(
        eventName,
        (event) => {
          event.stopPropagation();
        },
        { passive: true }
      );
    });
  });
}

function initTokenIdFromUrl() {
  if (typeof window === "undefined") {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const tokenId = params.get("tokenId");
  if (!tokenId) {
    return;
  }
  try {
    state.currentCubeTokenId = BigInt(tokenId);
    document.dispatchEvent(new CustomEvent("cube-token-change"));
  } catch (error) {
    state.currentCubeTokenId = null;
  }
}

function initLandingReturn() {
  const landingButton = document.getElementById("ui-landing");
  const mainPanel = document.getElementById("ui");
  if (!landingButton || !mainPanel) {
    return;
  }
  landingButton.addEventListener("click", () => {
    mainPanel.classList.remove("is-hidden");
    document.dispatchEvent(new CustomEvent("open-overlay"));
  });
}

function initMintedBanner() {
  const banner = document.getElementById("minted-banner");
  const linkButton = document.getElementById("minted-link");
  const copiedEl = document.getElementById("minted-copied");
  if (!banner || !linkButton || !copiedEl) {
    return;
  }

  let copyTimeout = null;

  function updateLink() {
    if (!state.currentCubeTokenId) {
      linkButton.dataset.url = "";
      linkButton.disabled = true;
      return;
    }
    const url = buildTokenViewUrl(state.currentCubeTokenId.toString());
    linkButton.dataset.url = url;
    linkButton.disabled = !url;
  }

  async function copyLink() {
    const url = linkButton.dataset.url;
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    copiedEl.classList.remove("is-hidden");
    if (copyTimeout) {
      window.clearTimeout(copyTimeout);
    }
    copyTimeout = window.setTimeout(() => {
      copiedEl.classList.add("is-hidden");
    }, 1500);
  }

  linkButton.addEventListener("click", copyLink);

  document.addEventListener("mint-complete", () => {
    updateLink();
    if (linkButton.dataset.url) {
      banner.classList.remove("is-hidden");
    }
  });

  document.addEventListener("cube-token-change", updateLink);
  updateLink();
}

function initDebugPanel() {
  const panel = document.getElementById("debug-panel");
  const logEl = document.getElementById("debug-log");
  const closeButton = document.getElementById("debug-close");
  if (!panel || !logEl || !closeButton) {
    return;
  }

  let buffer = [];

  function append(entry) {
    buffer.push(entry);
    if (buffer.length > 80) {
      buffer = buffer.slice(-80);
    }
    logEl.textContent = buffer.join("\n");
    panel.classList.remove("is-hidden");
  }

  function formatPayload(payload) {
    if (payload === null || payload === undefined) {
      return String(payload);
    }
    if (payload instanceof Error) {
      return payload.message;
    }
    if (typeof payload === "object") {
      try {
        return JSON.stringify(payload);
      } catch (error) {
        return "[object]";
      }
    }
    return String(payload);
  }

  function logWithPrefix(prefix, payload) {
    append(`${prefix} ${formatPayload(payload)}`);
  }

  window.addEventListener("error", (event) => {
    const details = event?.error?.stack || event?.message || "Unknown error";
    logWithPrefix("[error]", details);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    logWithPrefix("[promise]", reason);
  });

  document.addEventListener("wallet-error", (event) => {
    logWithPrefix("[wallet]", event?.detail || "Wallet error");
  });

  closeButton.addEventListener("click", () => {
    panel.classList.add("is-hidden");
  });
}

function initShareDialog() {
  const modal = document.getElementById("share-modal");
  const backdrop = document.getElementById("share-backdrop");
  const closeButton = document.getElementById("share-close");
  const copyButton = document.getElementById("share-copy");
  const farcasterLink = document.getElementById("share-farcaster");
  const xLink = document.getElementById("share-x");
  const baseLink = document.getElementById("share-base");
  const signalLink = document.getElementById("share-signal");

  if (
    !modal ||
    !backdrop ||
    !closeButton ||
    !copyButton ||
    !farcasterLink ||
    !xLink ||
    !baseLink ||
    !signalLink
  ) {
    return;
  }

  let currentUrl = "";

  function closeModal() {
    modal.classList.add("is-hidden");
  }

  async function copyLink() {
    if (!currentUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentUrl);
      copyButton.textContent = "Copied!";
    } catch (error) {
      copyButton.textContent = "Copy failed";
    }
    window.setTimeout(() => {
      copyButton.textContent = "Copy link";
    }, 1200);
  }

  function openModal(url) {
    currentUrl = url;
    const encoded = encodeURIComponent(url);
    const text = encodeURIComponent("Check out this cubixles_ cube");
    farcasterLink.href = `https://warpcast.com/~/compose?text=${text}&embeds[]=${encoded}`;
    xLink.href = `https://twitter.com/intent/tweet?text=${text}&url=${encoded}`;
    baseLink.href = `https://www.base.app/?link=${encoded}`;
    signalLink.href = `signal://send?text=${text}%20${encoded}`;
    modal.classList.remove("is-hidden");
  }

  backdrop.addEventListener("click", closeModal);
  closeButton.addEventListener("click", closeModal);
  copyButton.addEventListener("click", copyLink);

  document.addEventListener("share-link-open", (event) => {
    const url = event?.detail?.url;
    if (!url) {
      return;
    }
    if (navigator.share) {
      navigator
        .share({ title: "cubixles_", text: "Check out this cubixles_ cube", url })
        .catch(() => openModal(url));
      return;
    }
    openModal(url);
  });
}
