import { buildTokenViewUrl } from "../../config/links.js";
import { state } from "../../app/app-state.js";

const WAD = 1_000_000_000_000_000_000n;

export function formatLess(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value > 0n && value < 100_000_000_000_000n) {
    return "<0.0001";
  }
  const whole = value / WAD;
  const decimals = value % WAD;
  const decimalStr = (decimals / 10_000_000_000_000n).toString().padStart(4, "0");
  return `${whole.toString()}.${decimalStr}`;
}

export function initEthHud() {
  const hud = document.getElementById("eth-hud");
  const valueEl = document.getElementById("eth-hud-value");
  const timeEl = document.getElementById("eth-hud-time");
  if (!hud || !valueEl) {
    return;
  }

  function render() {
    valueEl.textContent = `ΔLESS ${formatLess(state.lessDeltaLast)}`;
    if (timeEl) {
      timeEl.textContent = "";
      const isTokenView = document.body.classList.contains("is-token-view");
      if (isTokenView && state.currentCubeTokenId) {
        const url = buildTokenViewUrl(state.currentCubeTokenId.toString());
        if (!url) {
          timeEl.textContent = "token: —";
          return;
        }
        const link = document.createElement("a");
        link.className = "eth-hud-link";
        link.textContent = "share link";
        link.href = url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.addEventListener("click", (event) => {
          event.preventDefault();
          document.dispatchEvent(new CustomEvent("share-link-open", { detail: { url } }));
        });
        timeEl.append(link);
      } else {
        timeEl.textContent = "token: —";
      }
    }
  }

  render();
  document.addEventListener("less-delta-change", render);
}
