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

export function initUiRoot() {
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
  initUiTouchGuards();
  initTokenIdFromUrl();
  initLandingReturn();
  initDebugPanel();
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
