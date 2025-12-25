import { sdk } from "@farcaster/miniapp-sdk";

const walletState = {
  status: "idle",
  address: null,
  provider: null,
  providerSource: null,
  error: null,
};

const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener({ ...walletState }));
}

function setState(patch) {
  Object.assign(walletState, patch);
  notify();
}

export function subscribeWallet(listener) {
  listeners.add(listener);
  listener({ ...walletState });
  return () => listeners.delete(listener);
}

export async function connectWallet() {
  setState({ status: "connecting", error: null });
  try {
    let provider = getBrowserProvider();
    let providerSource = provider ? "browser" : null;

    if (!provider) {
      const canUseMiniApp = Boolean(sdk?.isInMiniApp && sdk?.wallet?.getEthereumProvider);
      const inMiniApp = canUseMiniApp
        ? await sdk.isInMiniApp().catch(() => false)
        : false;
      if (!inMiniApp) {
        setState({
          status: "unavailable",
          address: null,
          provider: null,
          providerSource: null,
          error: "Open in Warpcast or a wallet browser (MetaMask/Coinbase).",
        });
        return;
      }
      provider = await sdk.wallet.getEthereumProvider();
      providerSource = "farcaster";
    }

    const accounts = await requestAccounts(provider);
    const address = accounts && accounts[0] ? accounts[0] : null;
    if (!address) {
      throw new Error("No accounts returned from provider.");
    }
    setState({ status: "connected", address, provider, providerSource });
  } catch (error) {
    if (typeof document !== "undefined") {
      document.dispatchEvent(
        new CustomEvent("wallet-error", {
          detail: error?.message || "Unable to connect wallet.",
        })
      );
    }
    setState({
      status: "error",
      address: null,
      provider: null,
      providerSource: null,
      error: error?.message || "Unable to connect wallet.",
    });
  }
}

export function disconnectWallet() {
  setState({
    status: "idle",
    address: null,
    provider: null,
    providerSource: null,
    error: null,
  });
}

export function getWalletState() {
  return { ...walletState };
}

async function requestAccounts(provider) {
  if (provider?.request) {
    return provider.request({ method: "eth_requestAccounts" });
  }
  if (provider?.send) {
    return provider.send("eth_requestAccounts");
  }
  throw new Error("Wallet provider does not support requests.");
}

function getBrowserProvider() {
  if (typeof window === "undefined") {
    return null;
  }
  const provider = window.ethereum || null;
  return provider;
}
