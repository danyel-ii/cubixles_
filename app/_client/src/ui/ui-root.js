import { initOverlay } from "./panels/overlay.js";
import { initLocalTextureUi } from "./panels/local-textures.js";
import { initExportUi } from "./panels/export-ui.js";
import { initLeaderboardUi } from "./panels/leaderboard.js";
import { initPreviewUi } from "./panels/preview.js";
import { initEthHud } from "./hud/eth-hud.js";
import { initLessSupplyHud } from "./hud/less-hud.js";
import { initLessDeltaTracking } from "./hud/less-delta.js";
import { initWalletUi, requestWalletConnection } from "../features/wallet/wallet-ui.js";
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
  if (typeof window !== "undefined") {
    window.__CUBIXLES_UI_READY__ = true;
  }
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
  initWalletClickGuard();
  initUiPointerGuard();
  initTokenIdFromUrl();
  initLandingReturn();
  initDebugPanel();
}

function initUiTouchGuards() {
  const selectors = ["#ui", "#leaderboard", "#preview-bar", "#overlay", "#wallet-picker"];
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

function initWalletClickGuard() {
  const connectButton = document.getElementById("wallet-connect");
  const statusEl = document.getElementById("wallet-status");
  if (!connectButton || !statusEl) {
    return;
  }
  let isConnecting = false;

  function handleConnect(event) {
    if (isConnecting) {
      return;
    }
    if (!(event.target instanceof Element)) {
      return;
    }
    if (!connectButton.contains(event.target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    statusEl.textContent = "Wallet: connecting…";
    isConnecting = true;
    requestWalletConnection()
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Connection failed.";
        statusEl.textContent = `Wallet: ${message}`;
      })
      .finally(() => {
        isConnecting = false;
      });
  }

  ["pointerdown", "touchstart", "click"].forEach((eventName) => {
    document.addEventListener(eventName, handleConnect, true);
  });
}

function initUiPointerGuard() {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.body;
  const selectors = [
    "#ui",
    "#leaderboard",
    "#preview-bar",
    "#overlay",
    "#wallet-picker",
    ".toast-root",
  ];

  function isUiElement(el) {
    if (!(el instanceof Element)) {
      return false;
    }
    return selectors.some((selector) => el.closest(selector));
  }

  function updatePointerState(event) {
    const point = event?.touches?.[0] || event;
    const x = point?.clientX;
    const y = point?.clientY;
    if (typeof x !== "number" || typeof y !== "number") {
      root.classList.remove("ui-pointer-active");
      return;
    }
    const el = document.elementFromPoint(x, y);
    root.classList.toggle("ui-pointer-active", isUiElement(el));
  }

  ["pointermove", "pointerdown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, updatePointerState, { passive: true });
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
