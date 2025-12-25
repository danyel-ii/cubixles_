import { state } from "../../app/app-state.js";
import { fetchLessTotalSupply } from "../../data/chain/less-supply.js";

const WAD = 1_000_000_000_000_000_000n;
const THOUSAND = 1_000n * WAD;
const TEN_THOUSAND = 10_000n * WAD;
const MILLION = 1_000_000n * WAD;
const REFRESH_MS = 60000;

function formatFixed(value, divisor) {
  const scaled = (value * 100n) / divisor;
  const whole = scaled / 100n;
  const decimals = scaled % 100n;
  return `${whole.toString()}.${decimals.toString().padStart(2, "0")}`;
}

function formatSupply(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value < THOUSAND) {
    return (value / WAD).toString();
  }
  if (value < MILLION) {
    return `${formatFixed(value, TEN_THOUSAND)} x10k`;
  }
  return `${formatFixed(value, MILLION)}M`;
}

export function initLessSupplyHud() {
  const valueEl = document.getElementById("less-supply-value");
  const timeEl = document.getElementById("less-supply-time");
  if (!valueEl) {
    return;
  }

  async function refresh() {
    try {
      const supply = await fetchLessTotalSupply();
      state.lessTotalSupply = supply;
      state.lessUpdatedAt = new Date().toISOString();
    } catch (error) {
      state.lessTotalSupply = null;
      state.lessUpdatedAt = null;
    } finally {
      valueEl.textContent = formatSupply(state.lessTotalSupply);
      if (timeEl) {
        timeEl.textContent = state.lessUpdatedAt
          ? `updated ${state.lessUpdatedAt.slice(11, 19)}`
          : "updated —";
      }
      document.dispatchEvent(new CustomEvent("less-supply-change"));
    }
  }

  refresh();
  setInterval(refresh, REFRESH_MS);
}
