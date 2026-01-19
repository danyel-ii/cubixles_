import { initOverlay } from "./panels/overlay.js";
import { initLocalTextureUi } from "./panels/local-textures.js";
import { initExportUi } from "./panels/export-ui.js";
import { initLeaderboardUi } from "./panels/leaderboard.js";
import { initPreviewUi } from "./panels/preview.js";
import { initEthHud } from "./hud/eth-hud.js";
import { initLessSupplyHud } from "./hud/less-hud.js";
import { initLessDeltaTracking } from "./hud/less-delta.js";
import { initBaseMintHud } from "./hud/base-mint-hud.js";
import { initWalletUi, requestWalletConnection } from "../features/wallet/wallet-ui.js";
import { setActiveChainId } from "../config/chains.js";
import { initNetworkUi } from "../features/network/network-ui.js";
import { initNftPickerUi } from "../features/nft/picker-ui.js";
import { initMintUi } from "../features/mint/mint-ui.js";
import { initBuilderMintUi } from "../features/mint/builder-mint-ui.js";
import { initPaperClipUi } from "../features/paperclip/paperclip-ui.js";
import { state } from "../app/app-state.js";
import { buildTokenViewUrl } from "../config/links.js";

let uiInitialized = false;
let uiDeferred = false;
let uiRetryCount = 0;
const UI_RETRY_LIMIT = 20;
const UI_RETRY_DELAY_MS = 50;

function hasUiAnchors() {
  if (typeof document === "undefined") {
    return true;
  }
  return Boolean(
    document.getElementById("ui") &&
      document.getElementById("wallet-connect") &&
      document.getElementById("mint-submit")
  );
}

function shouldSkipIntro() {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.__CUBIXLES_TEST_HOOKS__ || window.__CUBIXLES_SKIP_INTRO__) {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  if (!params.has("skipIntro")) {
    return false;
  }
  const value = params.get("skipIntro");
  if (value === null || value === "") {
    return true;
  }
  return value !== "0" && value.toLowerCase() !== "false";
}

export function initUiRoot() {
  if (uiInitialized) {
    return;
  }
  if (
    typeof document !== "undefined" &&
    document.body.classList.contains("is-intro")
  ) {
    if (shouldSkipIntro()) {
      document.body.classList.remove("is-intro");
    } else {
      if (!uiDeferred) {
        uiDeferred = true;
        document.addEventListener(
          "intro-complete",
          () => {
            uiDeferred = false;
            initUiRoot();
          },
          { once: true }
        );
      }
      return;
    }
  }
  if (!hasUiAnchors()) {
    if (uiRetryCount < UI_RETRY_LIMIT) {
      uiRetryCount += 1;
      window.setTimeout(initUiRoot, UI_RETRY_DELAY_MS);
    }
    return;
  }
  uiInitialized = true;
  uiRetryCount = 0;
  if (typeof window !== "undefined") {
    window.__CUBIXLES_UI_READY__ = true;
  }
  const isBuilderMode =
    typeof window !== "undefined" && window.__CUBIXLES_UI_MODE__ === "builder";
  if (isBuilderMode) {
    setActiveChainId(1);
  }
  initOverlay();
  initLocalTextureUi();
  initExportUi();
  initNetworkUi();
  initWalletUi();
  initNftPickerUi();
  if (isBuilderMode) {
    initBuilderMintUi();
    initPaperClipUi();
  } else {
    initMintUi();
  }
  initLeaderboardUi();
  if (!isBuilderMode) {
    initEthHud();
    initLessSupplyHud();
    initLessDeltaTracking();
  }
  initBaseMintHud();
  initPreviewUi();
  initMintedBanner();
  initUiTouchGuards();
  initWalletClickGuard();
  initUiPointerGuard();
  initTokenIdFromUrl();
  initLandingReturn();
}

function initUiTouchGuards() {
  const selectors = [
    "#ui",
    "#leaderboard",
    "#preview-bar",
    "#token-floor-panel",
    "#token-view-status",
    "#overlay",
    "#wallet-picker",
    "#network-picker",
    "#mint-confirm",
    "#share-cube",
    "#share-modal",
    "#paperclip-panel",
  ];
  const selectorList = selectors.join(", ");
  const stopTouchPropagation = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest(selectorList)) {
      event.stopPropagation();
    }
  };
  ["touchstart", "touchmove", "touchend"].forEach((eventName) => {
    document.addEventListener(eventName, stopTouchPropagation, { passive: true });
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
    "#token-floor-panel",
    "#token-view-status",
    "#overlay",
    "#wallet-picker",
    "#network-picker",
    "#mint-confirm",
    "#share-cube",
    "#share-modal",
    "#paperclip-panel",
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
  if (!banner || !linkButton) {
    return;
  }

  function updateLink() {
    if (!state.currentCubeTokenId) {
      return;
    }
    void buildTokenViewUrl(state.currentCubeTokenId.toString());
  }

  document.addEventListener("mint-complete", () => {
    updateLink();
    banner.classList.remove("is-hidden");
  });

  document.addEventListener("cube-token-change", updateLink);
  updateLink();
}
