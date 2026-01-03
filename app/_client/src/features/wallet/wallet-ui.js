import {
  connectWallet,
  disconnectWallet,
  subscribeWallet,
  switchToMainnet,
} from "./wallet.js";
import { CUBIXLES_CONTRACT } from "../../config/contracts";

export function initWalletUi() {
  const connectButton = document.getElementById("wallet-connect");
  const disconnectButton = document.getElementById("wallet-disconnect");
  const switchButton = document.getElementById("wallet-switch");
  const statusEl = document.getElementById("wallet-status");

  if (!connectButton || !disconnectButton || !statusEl || !switchButton) {
    return;
  }

  connectButton.addEventListener("click", async () => {
    statusEl.textContent = "Wallet: connecting…";
    try {
      await connectWallet();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed.";
      statusEl.textContent = `Wallet: ${message}`;
    }
  });
  disconnectButton.addEventListener("click", () => disconnectWallet());
  switchButton.addEventListener("click", () => switchToMainnet());

  function formatChainName(chainId) {
    if (chainId === 1) {
      return "Ethereum Mainnet";
    }
    if (chainId === 11155111) {
      return "Sepolia";
    }
    return `Chain ${chainId}`;
  }

  subscribeWallet((state) => {
    const safeState = state || {
      status: "error",
      error: "Wallet state unavailable.",
    };
    const isConnected = safeState.status === "connected";
    connectButton.classList.toggle("is-pulse-magenta", !isConnected);

    if (safeState.status === "connected") {
      const chainId = safeState.chainId;
      const expected = CUBIXLES_CONTRACT.chainId;
      if (chainId && chainId !== expected) {
        statusEl.textContent = `Wallet: connected (wrong network: ${formatChainName(chainId)})`;
        switchButton.classList.remove("is-hidden");
        switchButton.disabled = false;
      } else {
        statusEl.textContent = "Wallet: connected";
        switchButton.classList.add("is-hidden");
        switchButton.disabled = true;
      }
      connectButton.disabled = true;
      disconnectButton.disabled = false;
      return;
    }

    if (safeState.status === "connecting") {
      statusEl.textContent = "Wallet: connecting…";
      connectButton.disabled = true;
      disconnectButton.disabled = true;
      switchButton.classList.add("is-hidden");
      switchButton.disabled = true;
      return;
    }

    if (safeState.status === "error") {
      statusEl.textContent = `Wallet: ${safeState.error || "Connection failed."}`;
      connectButton.disabled = false;
      disconnectButton.disabled = true;
      switchButton.classList.add("is-hidden");
      switchButton.disabled = true;
      return;
    }

    if (safeState.status === "unavailable") {
      statusEl.textContent = `Wallet: ${safeState.error || "Unavailable."}`;
      connectButton.disabled = false;
      disconnectButton.disabled = true;
      switchButton.classList.add("is-hidden");
      switchButton.disabled = true;
      return;
    }

    statusEl.textContent = "Wallet: not connected.";
    connectButton.disabled = false;
    disconnectButton.disabled = true;
    switchButton.classList.add("is-hidden");
    switchButton.disabled = true;
  });
}
