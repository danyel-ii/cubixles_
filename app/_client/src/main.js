import { Buffer } from "buffer";
import { registerAppLifecycle } from "./app/app-lifecycle.js";
import { initTokenViewRoute } from "./routes/token-view.js";
import { initUiRoot } from "./ui/ui-root.js";

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

registerAppLifecycle();
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUiRoot, { once: true });
  } else {
    initUiRoot();
  }
}
initTokenViewRoute();

let p5LoadPromise;

function loadP5Library() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }
  if (window.__CUBIXLES_P5_PROMISE__) {
    return window.__CUBIXLES_P5_PROMISE__;
  }
  if (typeof window.p5 === "function") {
    return Promise.resolve();
  }
  if (window.__CUBIXLES_P5_LOADING__) {
    return p5LoadPromise || Promise.resolve();
  }
  if (p5LoadPromise) {
    return p5LoadPromise;
  }
  p5LoadPromise = new Promise((resolve, reject) => {
    const existingScripts = Array.from(
      document.querySelectorAll('script[src*="p5.min.js"]')
    );
    const existing = document.getElementById("p5-lib") || existingScripts[0];
    if (existing) {
      if (existingScripts.length > 1) {
        existingScripts.slice(1).forEach((script) => script.remove());
      }
      const poll = () => {
        if (typeof window.p5 === "function") {
          resolve();
          return;
        }
        setTimeout(poll, 50);
      };
      poll();
      return;
    }
    window.__CUBIXLES_P5_LOADING__ = true;
    const script = document.createElement("script");
    script.id = "p5-lib";
    script.src = "https://cdn.jsdelivr.net/npm/p5@1.9.2/lib/p5.min.js";
    script.async = true;
    window.__CUBIXLES_P5_SCRIPT__ = script;
    script.onload = () => {
      window.__CUBIXLES_P5_LOADING__ = false;
      resolve();
    };
    script.onerror = () => {
      window.__CUBIXLES_P5_LOADING__ = false;
      reject(new Error("Failed to load p5.js"));
    };
    document.head.appendChild(script);
  });
  window.__CUBIXLES_P5_PROMISE__ = p5LoadPromise;
  return p5LoadPromise;
}

function ensureP5Instance() {
  if (typeof window === "undefined") {
    return;
  }
  if (window.__CUBIXLES_P5_INSTANCE__ || window.__CUBELESS_P5__) {
    return;
  }
  if (window.__CUBIXLES_P5_INIT__) {
    return;
  }
  window.__CUBIXLES_P5_INIT__ = true;
  loadP5Library()
    .then(() => {
      if (
        window.__CUBIXLES_P5_INSTANCE__ ||
        window.__CUBELESS_P5__ ||
        typeof window.p5 !== "function"
      ) {
        window.__CUBIXLES_P5_INIT__ = false;
        return;
      }
      const instance = new window.p5();
      window.__CUBIXLES_P5_INSTANCE__ = instance;
      window.__CUBELESS_P5__ = instance;
      window.__CUBIXLES_P5_INIT__ = false;
    })
    .catch((error) => {
      window.__CUBIXLES_P5_INIT__ = false;
      console.warn("p5.js failed to load:", error);
    });
}

ensureP5Instance();
