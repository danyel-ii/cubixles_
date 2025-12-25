import { connectWallet, disconnectWallet, subscribeWallet } from "./wallet.js";

function formatAddress(address) {
  if (!address) {
    return "";
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function initWalletUi() {
  const connectButton = document.getElementById("wallet-connect");
  const disconnectButton = document.getElementById("wallet-disconnect");
  const statusEl = document.getElementById("wallet-status");

  if (!connectButton || !disconnectButton || !statusEl) {
    return;
  }

  connectButton.addEventListener("click", () => connectWallet());
  disconnectButton.addEventListener("click", () => disconnectWallet());

  subscribeWallet((state) => {
    const safeState = state || {
      status: "error",
      error: "Wallet state unavailable.",
    };

    if (safeState.status === "connected") {
      const sourceLabel = safeState.providerSource
        ? ` via ${safeState.providerSource}`
        : "";
      statusEl.textContent = `Wallet: ${formatAddress(
        safeState.address
      )}${sourceLabel}`;
      connectButton.disabled = true;
      disconnectButton.disabled = false;
      return;
    }

    if (safeState.status === "connecting") {
      statusEl.textContent = "Wallet: connecting…";
      connectButton.disabled = true;
      disconnectButton.disabled = true;
      return;
    }

    if (safeState.status === "error") {
      statusEl.textContent = `Wallet: ${safeState.error || "Connection failed."}`;
      connectButton.disabled = false;
      disconnectButton.disabled = true;
      return;
    }

    if (safeState.status === "unavailable") {
      statusEl.textContent = `Wallet: ${safeState.error || "Unavailable."}`;
      connectButton.disabled = false;
      disconnectButton.disabled = true;
      return;
    }

    statusEl.textContent = "Wallet: not connected.";
    connectButton.disabled = false;
    disconnectButton.disabled = true;
  });
}
