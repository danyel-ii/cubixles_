import { state } from "../../app/app-state.js";
import { getActiveChainId, getChainConfig, subscribeActiveChain } from "../../config/chains.js";

const WAD = 1_000_000_000_000_000_000n;
const SIX_DECIMALS = 1_000_000_000_000n;

function formatEthFromWei(wei) {
  if (wei === null || wei === undefined) {
    return "—";
  }
  const whole = wei / WAD;
  const remainder = wei % WAD;
  const decimals = (remainder / SIX_DECIMALS).toString().padStart(6, "0");
  return `${whole.toString()}.${decimals}`;
}

function shouldShowHud(chainId) {
  const chain = getChainConfig(chainId);
  return Boolean(chain?.id === 8453 && document.body.classList.contains("is-token-view"));
}

export function initBaseMintHud() {
  const hud = document.getElementById("base-mint-hud");
  const valueEl = document.getElementById("base-mint-hud-value");
  if (!hud || !valueEl) {
    return;
  }
  let activeChainId = getActiveChainId();

  function render() {
    const visible = shouldShowHud(activeChainId);
    hud.classList.toggle("is-hidden", !visible);
    if (!visible) {
      return;
    }
    const price = state.tokenMintPriceWei;
    valueEl.textContent = price
      ? `Mint price: ${formatEthFromWei(price)} ETH`
      : "Mint price: —";
  }

  render();
  document.addEventListener("token-mint-price-change", render);
  document.addEventListener("cube-token-change", render);
  subscribeActiveChain((chainId) => {
    activeChainId = chainId;
    render();
  });
}
