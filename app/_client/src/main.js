import { Buffer } from "buffer";
import { registerAppLifecycle } from "./app/app-lifecycle.js";
import { notifyFarcasterReady } from "./features/farcaster/frame-ready.js";
import { initTokenViewRoute } from "./routes/token-view.js";
import { initPaletteTheme } from "./ui/palette-theme.js";
import { initUiRoot } from "./ui/ui-root.js";

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

if (typeof document !== "undefined") {
  initPaletteTheme();
}

const isTestHooks =
  typeof window !== "undefined" && window.__CUBIXLES_TEST_HOOKS__ === true;

registerAppLifecycle();
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        initUiRoot();
        notifyFarcasterReady();
      },
      { once: true }
    );
  } else {
    initUiRoot();
    notifyFarcasterReady();
  }
}
initTokenViewRoute();

let p5LoadPromise;

function loadP5Library() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }
  if (window.__CUBIXLES_P5_PROMISE__) {
    return window.__CUBIXLES_P5_PROMISE__;
  }
  if (p5LoadPromise) {
    return p5LoadPromise;
  }
  p5LoadPromise = import("p5")
    .then((module) => {
      const P5 = module?.default ?? module;
      if (typeof P5 === "function") {
        window.__CUBIXLES_P5__ = P5;
        window.p5 = P5;
      }
      return P5 ?? null;
    })
    .catch((error) => {
      console.warn("p5.js failed to load:", error);
      return null;
    });
  window.__CUBIXLES_P5_PROMISE__ = p5LoadPromise;
  return p5LoadPromise;
}

function ensureP5Instance() {
  if (typeof window === "undefined") {
    return;
  }
  if (window.__CUBIXLES_P5_INIT__) {
    return;
  }
  window.__CUBIXLES_P5_INIT__ = true;
  loadP5Library()
    .finally(() => {
      window.__CUBIXLES_P5_INIT__ = false;
    });
}

if (!isTestHooks) {
  ensureP5Instance();
}
