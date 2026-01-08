import { sdk } from "@farcaster/miniapp-sdk";
import { CUBIXLES_CONTRACT } from "../../config/contracts";
import {
  getActiveChain,
  getActiveChainId,
  getChainConfig,
  subscribeActiveChain,
} from "../../config/chains.js";

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

export async function connectWallet(options = {}) {
  setState({ status: "connecting", error: null });
  try {
    let provider = null;
    let providerSource = null;
    const browserProvider = getBrowserProvider();
    const preferredProvider = options?.provider || null;
    const preferredSource = options?.source || null;

    const canUseMiniApp = Boolean(sdk?.isInMiniApp && sdk?.wallet?.getEthereumProvider);
    const inMiniApp = canUseMiniApp
      ? await sdk.isInMiniApp().catch(() => false)
      : false;

    if (preferredProvider) {
      provider = preferredProvider;
      if (preferredSource) {
        providerSource = preferredSource;
      } else if (isWalletConnectProvider(provider)) {
        providerSource = "walletconnect";
      } else {
        providerSource = "browser";
      }
    } else if (inMiniApp) {
      try {
        provider = await getWalletConnectProvider();
        providerSource = "walletconnect";
      } catch (error) {
        throw new Error(
          "WalletConnect is required in Farcaster. Check NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID."
        );
      }
    } else if (browserProvider) {
      provider = browserProvider;
      providerSource = "browser";
    } else {
      provider = await getWalletConnectProvider();
      providerSource = "walletconnect";
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
    const timeoutMs = providerSource === "walletconnect" ? 20000 : 12000;
    try {
      accounts = await requestAccountsWithTimeout(provider, timeoutMs);
    } catch (error) {
      if (providerSource === "browser") {
        throw error;
      }
      throw error;
    }
    const address = accounts && accounts[0] ? accounts[0] : null;
    if (!address) {
      throw new Error("No accounts returned from provider.");
    }
    const chainId = await readChainId(provider);
    setState({ status: "connected", address, provider, providerSource, chainId });
    await ensureChain(provider, getActiveChainId());
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
    try {
      const chainIdHex = await provider.request({ method: "eth_chainId" });
      if (typeof chainIdHex === "string") {
        return Number.parseInt(chainIdHex, 16);
      }
    } catch (error) {
      return null;
    }
  }
  return null;
}

function buildAddChainParams(chainId) {
  const chain = getChainConfig(chainId);
  if (!chain) {
    return null;
  }
  return {
    chainId: `0x${chainId.toString(16)}`,
    chainName: chain.name,
    rpcUrls: chain.rpcUrls,
    nativeCurrency: {
      name: chain.shortName,
      symbol: chain.shortName === "Base" ? "ETH" : "ETH",
      decimals: 18,
    },
    blockExplorerUrls: chain.explorer ? [chain.explorer] : undefined,
  };
}

async function ensureChain(provider, desiredChainId) {
  if (!provider?.request || !desiredChainId) {
    return false;
  }
  if (isWalletConnectProvider(provider)) {
    const hasSession = Boolean(provider.session);
    const hasAccounts = Array.isArray(provider.accounts) && provider.accounts.length > 0;
    if (!provider.connected && !hasSession && !hasAccounts) {
      return false;
    }
  }
  const current = await readChainId(provider);
  if (current === desiredChainId) {
    setState({ chainId: current });
    return true;
  }
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${desiredChainId.toString(16)}` }],
    });
    const updated = await readChainId(provider);
    setState({ chainId: updated });
    return updated === desiredChainId;
  } catch (error) {
    const code = error?.code ?? error?.data?.originalError?.code;
    if (code === 4902) {
      const params = buildAddChainParams(desiredChainId);
      if (!params) {
        setState({ chainId: current });
        return false;
      }
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [params],
        });
        const updated = await readChainId(provider);
        setState({ chainId: updated });
        return updated === desiredChainId;
      } catch (addError) {
        setState({ chainId: current });
        return false;
      }
    }
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
    icons: [`${window.location.origin}/assets/icon.png`],
  };
  const activeChainId = getActiveChainId();
  const optionalChains = getActiveChain()
    ? [1, 8453].filter((id) => id !== activeChainId)
    : [1, 8453];
  walletConnectProviderPromise = import("@walletconnect/ethereum-provider").then(
    ({ EthereumProvider }) =>
      EthereumProvider.init({
        projectId,
        chains: [activeChainId],
        optionalChains,
        showQrModal: true,
        metadata,
      })
  );
  return walletConnectProviderPromise;
}

export async function switchToActiveChain() {
  if (!walletState.provider) {
    return false;
  }
  return ensureChain(walletState.provider, getActiveChainId());
}

subscribeActiveChain(() => {
  walletConnectProviderPromise = null;
});

if (typeof window !== "undefined" && window.__CUBIXLES_TEST_HOOKS__) {
  window.__CUBIXLES_WALLET__ = {
    connectWallet,
    disconnectWallet,
    getWalletState,
  };
}
