import { sdk } from "@farcaster/miniapp-sdk";
import { CUBIXLES_CONTRACT } from "../../config/contracts";

const walletState = {
  status: "idle",
  address: null,
  provider: null,
  providerSource: null,
  chainId: null,
  error: null,
};

const listeners = new Set();
let walletConnectProviderPromise = null;

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
    let provider = null;
    let providerSource = null;
    const browserProvider = getBrowserProvider();

    const canUseMiniApp = Boolean(sdk?.isInMiniApp && sdk?.wallet?.getEthereumProvider);
    const inMiniApp = canUseMiniApp
      ? await sdk.isInMiniApp().catch(() => false)
      : false;

    if (inMiniApp) {
      try {
        provider = await getWalletConnectProvider();
        providerSource = "walletconnect";
      } catch (error) {
        provider = await sdk.wallet.getEthereumProvider();
        providerSource = "farcaster";
      }
    } else {
      try {
        provider = await getWalletConnectProvider();
        providerSource = "walletconnect";
      } catch (error) {
        provider = browserProvider;
        providerSource = provider ? "browser" : null;
      }
    }

    if (!provider) {
      throw new Error("No wallet provider available.");
    }

    const needsWalletConnect =
      providerSource === "walletconnect" || isWalletConnectProvider(provider);
    if (needsWalletConnect && providerSource !== "walletconnect") {
      providerSource = "walletconnect";
    }
    if (needsWalletConnect) {
      await ensureWalletConnectSession(provider);
    }

    let accounts = null;
    try {
      accounts = await requestAccountsWithTimeout(provider);
    } catch (error) {
      if (providerSource === "browser") {
        provider = await getWalletConnectProvider();
        providerSource = "walletconnect";
        await ensureWalletConnectSession(provider);
        accounts = await requestAccountsWithTimeout(provider);
      } else {
        throw error;
      }
    }
    const address = accounts && accounts[0] ? accounts[0] : null;
    if (!address) {
      throw new Error("No accounts returned from provider.");
    }
    const chainId = await readChainId(provider);
    setState({ status: "connected", address, provider, providerSource, chainId });
    await ensureChain(provider, CUBIXLES_CONTRACT.chainId);
    attachProviderListeners(provider);
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
      chainId: null,
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
    chainId: null,
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

async function requestAccountsWithTimeout(provider, timeoutMs = 5000) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Wallet request timed out."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([requestAccounts(provider), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function isWalletConnectProvider(provider) {
  return Boolean(
    provider &&
      (provider.isWalletConnect ||
        provider.session ||
        provider.connector?.protocol === "wc" ||
        provider.signer?.session)
  );
}

async function ensureWalletConnectSession(provider) {
  if (!provider) {
    return;
  }
  const hasAccounts = Array.isArray(provider.accounts) && provider.accounts.length > 0;
  const connected = provider.connected === true || hasAccounts;
  if (connected) {
    return;
  }
  if (typeof provider.connect === "function") {
    await provider.connect();
    return;
  }
  if (typeof provider.enable === "function") {
    await provider.enable();
  }
}

async function readChainId(provider) {
  if (provider?.request) {
    const chainIdHex = await provider.request({ method: "eth_chainId" });
    if (typeof chainIdHex === "string") {
      return Number.parseInt(chainIdHex, 16);
    }
  }
  return null;
}

async function ensureChain(provider, desiredChainId) {
  if (!provider?.request || !desiredChainId) {
    return false;
  }
  const current = await readChainId(provider);
  if (current === desiredChainId) {
    setState({ chainId: current });
    return true;
  }
  const chainHex = `0x${desiredChainId.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainHex }],
    });
    const updated = await readChainId(provider);
    setState({ chainId: updated });
    return updated === desiredChainId;
  } catch (error) {
    setState({ chainId: current });
    return false;
  }
}

function attachProviderListeners(provider) {
  if (!provider?.on) {
    return;
  }
  provider.on("accountsChanged", (accounts) => {
    const address = accounts && accounts[0] ? accounts[0] : null;
    setState({ address, status: address ? "connected" : "idle" });
  });
  provider.on("chainChanged", (chainIdHex) => {
    if (typeof chainIdHex !== "string") {
      return;
    }
    setState({ chainId: Number.parseInt(chainIdHex, 16) });
  });
}

function getBrowserProvider() {
  if (typeof window === "undefined") {
    return null;
  }
  const provider = window.ethereum || null;
  return provider;
}

async function getWalletConnectProvider() {
  if (walletConnectProviderPromise) {
    return walletConnectProviderPromise;
  }
  if (typeof window === "undefined") {
    throw new Error("WalletConnect is only available in the browser.");
  }
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "WalletConnect is not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID."
    );
  }
  const metadata = {
    name: "cubixles_",
    description: "cubixles_ miniapp",
    url: window.location.origin,
    icons: [`${window.location.origin}/icon.png`],
  };
  walletConnectProviderPromise = import("@walletconnect/ethereum-provider").then(
    ({ EthereumProvider }) =>
      EthereumProvider.init({
        projectId,
        chains: [CUBIXLES_CONTRACT.chainId],
        optionalChains: [11155111],
        showQrModal: true,
        metadata,
      })
  );
  return walletConnectProviderPromise;
}

export async function switchToMainnet() {
  if (!walletState.provider) {
    return false;
  }
  return ensureChain(walletState.provider, CUBIXLES_CONTRACT.chainId);
}

if (typeof window !== "undefined" && window.__CUBIXLES_TEST_HOOKS__) {
  window.__CUBIXLES_WALLET__ = {
    connectWallet,
    disconnectWallet,
    getWalletState,
  };
}
