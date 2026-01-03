import {
  connectWallet,
  disconnectWallet,
  subscribeWallet,
  switchToMainnet,
} from "./wallet.js";
import { CUBIXLES_CONTRACT } from "../../config/contracts";

const providerRegistry = new Map();
let discoveryStarted = false;
let isConnecting = false;
const walletUiState = {
  connectButton: null,
  disconnectButton: null,
  switchButton: null,
  statusEl: null,
  pickerRoot: null,
  pickerList: null,
  pickerClose: null,
};

function startProviderDiscovery() {
  if (discoveryStarted || typeof window === "undefined") {
    return;
  }
  discoveryStarted = true;
  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = event?.detail;
    if (!detail?.provider || !detail?.info) {
      return;
    }
    const key = detail.info.uuid || detail.info.name;
    if (!providerRegistry.has(key)) {
      providerRegistry.set(key, detail);
      renderPickerOptions();
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function getProviderEntries() {
  return Array.from(providerRegistry.values());
}

function showWalletPicker() {
  const { pickerRoot } = walletUiState;
  if (!pickerRoot) {
    return false;
  }
  renderPickerOptions();
  pickerRoot.classList.remove("is-hidden");
  document.body.classList.add("wallet-modal-open");
  return true;
}

function hideWalletPicker() {
  const { pickerRoot } = walletUiState;
  if (!pickerRoot) {
    return;
  }
  pickerRoot.classList.add("is-hidden");
  document.body.classList.remove("wallet-modal-open");
}

function renderPickerOptions() {
  const { pickerList } = walletUiState;
  if (!pickerList) {
    return;
  }
  pickerList.innerHTML = "";
  const entries = getProviderEntries();
  if (!entries.length) {
    return;
  }
  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wallet-picker-option";
    const icon = document.createElement("img");
    icon.alt = entry.info?.name ? `${entry.info.name} icon` : "Wallet icon";
    if (entry.info?.icon) {
      icon.src = entry.info.icon;
    }
    const label = document.createElement("div");
    label.textContent = entry.info?.name || "Browser wallet";
    button.appendChild(icon);
    button.appendChild(label);
    button.addEventListener("click", () => {
      hideWalletPicker();
      requestWalletConnection(entry.provider);
    });
    fragment.appendChild(button);
  });
  pickerList.appendChild(fragment);
}

export async function requestWalletConnection(selectedProvider = null) {
  const { statusEl, connectButton } = walletUiState;
  if (!statusEl || !connectButton || isConnecting) {
    return;
  }
  isConnecting = true;
  try {
    if (selectedProvider) {
      statusEl.textContent = "Wallet: connecting…";
      await connectWallet({ provider: selectedProvider, source: "browser" });
      return;
    }
    const providers = getProviderEntries();
    if (providers.length > 1) {
      statusEl.textContent = "Wallet: choose a wallet.";
      showWalletPicker();
      return;
    }
    if (providers.length === 1) {
      statusEl.textContent = "Wallet: connecting…";
      await connectWallet({ provider: providers[0].provider, source: "browser" });
      return;
    }
    statusEl.textContent = "Wallet: connecting…";
    await connectWallet();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed.";
    statusEl.textContent = `Wallet: ${message}`;
  } finally {
    isConnecting = false;
  }
}

export function initWalletUi() {
  const connectButton = document.getElementById("wallet-connect");
  const disconnectButton = document.getElementById("wallet-disconnect");
  const switchButton = document.getElementById("wallet-switch");
  const statusEl = document.getElementById("wallet-status");
  const pickerRoot = document.getElementById("wallet-picker");
  const pickerList = document.getElementById("wallet-picker-list");
  const pickerClose = document.getElementById("wallet-picker-close");

  if (!connectButton || !disconnectButton || !statusEl || !switchButton) {
    return;
  }

  walletUiState.connectButton = connectButton;
  walletUiState.disconnectButton = disconnectButton;
  walletUiState.switchButton = switchButton;
  walletUiState.statusEl = statusEl;
  walletUiState.pickerRoot = pickerRoot;
  walletUiState.pickerList = pickerList;
  walletUiState.pickerClose = pickerClose;

  startProviderDiscovery();
  connectButton.addEventListener("click", () => requestWalletConnection());
  disconnectButton.addEventListener("click", () => disconnectWallet());
  switchButton.addEventListener("click", () => switchToMainnet());
  if (pickerClose) {
    pickerClose.addEventListener("click", hideWalletPicker);
  }
  if (pickerRoot) {
    pickerRoot.addEventListener("click", (event) => {
      if (event.target === pickerRoot) {
        hideWalletPicker();
      }
    });
  }

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
    if (safeState.status !== "connecting") {
      hideWalletPicker();
    }
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
