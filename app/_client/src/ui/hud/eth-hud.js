import { state } from "../../app/app-state.js";

const WAD = 1_000_000_000_000_000_000n;

function formatLess(value) {
  if (value === null || value === undefined) {
    return "—";
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
      timeEl.textContent = state.currentCubeTokenId
        ? `token #${state.currentCubeTokenId.toString()}`
        : "token: —";
    }
  }

  render();
  document.addEventListener("less-delta-change", render);
}
