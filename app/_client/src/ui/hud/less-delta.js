import { state } from "../../app/app-state.js";
import { subscribeWallet } from "../../features/wallet/wallet.js";
import { fetchLessDelta } from "../../data/chain/less-delta.js";

export function initLessDeltaTracking() {
  let walletState = null;

  async function refresh() {
    if (state.currentCubeTokenId === null || state.currentCubeTokenId === undefined) {
      state.lessDeltaLast = null;
      state.lessDeltaMint = null;
      state.lessSupplyNow = null;
      state.lessDeltaUpdatedAt = null;
      document.dispatchEvent(new CustomEvent("less-delta-change"));
      return;
    }
    try {
      const metrics = await fetchLessDelta(
        walletState?.provider ?? null,
        state.currentCubeTokenId
      );
      if (!metrics) {
        throw new Error("Delta unavailable.");
      }
      state.lessSupplyNow = metrics.supplyNow;
      state.lessDeltaLast = metrics.deltaFromLast;
      state.lessDeltaMint = metrics.deltaFromMint;
      state.lessDeltaUpdatedAt = new Date().toISOString();
    } catch (error) {
      state.lessSupplyNow = null;
      state.lessDeltaLast = null;
      state.lessDeltaMint = null;
      state.lessDeltaUpdatedAt = null;
    } finally {
      document.dispatchEvent(new CustomEvent("less-delta-change"));
    }
  }

  subscribeWallet((next) => {
    walletState = next;
    refresh();
  });

  document.addEventListener("cube-token-change", () => {
    refresh();
  });
}
