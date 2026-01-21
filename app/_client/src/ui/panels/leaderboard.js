import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { getBuilderContract } from "../../config/builder-contracts";
import { getCubixlesContract } from "../../config/contracts";
import { subscribeWallet } from "../../features/wallet/wallet.js";
import {
  formatChainName,
  getChainConfig,
  subscribeActiveChain,
} from "../../config/chains.js";
import { buildBuilderTokenViewUrl } from "../../config/links.js";

const MAX_ENTRIES = 50;
const WAD = 1_000_000_000_000_000_000n;

export function formatDelta(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  const whole = value / WAD;
  const decimals = value % WAD;
  const decimalStr = (decimals / 10_000_000_000_000n).toString().padStart(4, "0");
  return `${whole.toString()}.${decimalStr}`;
}

function isZeroAddress(address) {
  return !address || address === "0x0000000000000000000000000000000000000000";
}

export function shortenAddress(address) {
  if (!address) {
    return "—";
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function fetchIdentity(address) {
  const response = await fetch(`/api/identity?address=${address}`);
  if (!response.ok) {
    return null;
  }
  return response.json();
}

export function initLeaderboardUi() {
  const isBuilder = document.body?.classList.contains("is-builder");
  const openButton = document.getElementById("leaderboard-open");
  const backButton = document.getElementById("leaderboard-back");
  const landingButton = document.getElementById("leaderboard-landing");
  const mainPanel = document.getElementById("ui");
  const leaderboardPanel = document.getElementById("leaderboard");
  const contractEl = document.getElementById("leaderboard-contract");
  const chainEl = document.getElementById("leaderboard-chain");
  const supplyEl = document.getElementById("leaderboard-supply");
  const updatedEl = document.getElementById("leaderboard-updated");
  const statusEl = document.getElementById("leaderboard-status");
  const listEl = document.getElementById("leaderboard-list");

  if (
    !openButton ||
    !backButton ||
    !landingButton ||
    !mainPanel ||
    !leaderboardPanel ||
    !contractEl ||
    !chainEl ||
    !updatedEl ||
    !statusEl ||
    !listEl ||
    !supplyEl
  ) {
    return;
  }

  let walletState = null;
  let readProviderPromise = null;

  function getContractConfig() {
    return isBuilder ? getBuilderContract() : getCubixlesContract();
  }

  function isTargetChainConnected() {
    const contract = getContractConfig();
    return walletState?.status === "connected" && walletState?.chainId === contract.chainId;
  }

  function updateOpenButtonVisibility() {
    const show = isTargetChainConnected();
    openButton.classList.toggle("is-hidden", !show);
    openButton.disabled = !show;
    openButton.setAttribute("aria-hidden", String(!show));
  }

  function updateLeaderboardDetails() {
    const contract = getContractConfig();
    contractEl.textContent = `Contract: ${contract.address}`;
    chainEl.textContent = `Chain: ${formatChainName(contract.chainId)}`;
    updatedEl.textContent = `Last updated: ${new Date().toISOString()}`;
  }

  function resetList(message) {
    statusEl.textContent = message;
    listEl.innerHTML = "";
  }

  function isLeaderboardSupported() {
    const contract = getContractConfig();
    const chain = getChainConfig(contract.chainId);
    if (isBuilder) {
      return Boolean(chain);
    }
    return Boolean(chain?.supportsLess && chain?.id === 1);
  }

  async function getReadProvider(provider) {
    const contract = getContractConfig();
    const chain = getChainConfig(contract.chainId);
    const walletProvider = provider || walletState?.provider;
    if (walletProvider) {
      return new BrowserProvider(walletProvider);
    }
    if (chain?.rpcUrls?.length) {
      if (readProviderPromise) {
        return readProviderPromise;
      }
      readProviderPromise = (async () => {
        for (const url of chain.rpcUrls) {
          const candidate = new JsonRpcProvider(url);
          try {
            await candidate.getBlockNumber();
            return candidate;
          } catch (error) {
            continue;
          }
        }
        if (provider || walletState?.provider) {
          return new BrowserProvider(provider || walletState.provider);
        }
        return null;
      })();
      return readProviderPromise;
    }
    if (provider || walletState?.provider) {
      return new BrowserProvider(provider || walletState.provider);
    }
    return null;
  }

  async function fetchMintedTokenIds(provider) {
    const contractInfo = getContractConfig();
    const readProvider = await getReadProvider(provider);
    if (!readProvider) {
      return [];
    }
    const contract = new Contract(contractInfo.address, contractInfo.abi, readProvider);
    const totalMinted = await contract.totalMinted();
    const count = Number(totalMinted);
    if (!count) {
      return [];
    }
    const ids = await Promise.all(
      Array.from({ length: count }, (_, index) => contract.tokenIdByIndex(index + 1))
    );
    return ids.map((tokenId) => BigInt(tokenId));
  }

  async function fetchLeaderboard() {
    const contractInfo = getContractConfig();
    const readProvider = await getReadProvider(null);
    if (!readProvider) {
      return { entries: [], supplyNow: null };
    }
    const contract = new Contract(contractInfo.address, contractInfo.abi, readProvider);
    if (isBuilder) {
      const totalMinted = await contract.totalMinted();
      const count = Number(totalMinted);
      if (!count) {
        return { entries: [], totalMinted: BigInt(totalMinted) };
      }
      const entries = await Promise.all(
        Array.from({ length: count }, (_, index) => {
          const tokenId = BigInt(index + 1);
          return Promise.all([
            contract.mintPriceByTokenId(tokenId).catch(() => 0n),
            contract.ownerOf(tokenId).catch(() => null),
          ]).then(([mintPrice, owner]) => ({
            tokenId,
            mintPrice: BigInt(mintPrice || 0),
            owner,
          }));
        })
      );
      entries.sort((a, b) => {
        if (a.mintPrice === b.mintPrice) {
          return a.tokenId > b.tokenId ? 1 : -1;
        }
        return a.mintPrice > b.mintPrice ? -1 : 1;
      });
      const sliced = entries.slice(0, MAX_ENTRIES);
      const identityEntries = await Promise.all(
        sliced.map(async (entry) => {
          const identity = entry.owner ? await fetchIdentity(entry.owner) : null;
          return { ...entry, identity };
        })
      );
      return {
        entries: identityEntries,
        totalMinted: BigInt(totalMinted),
      };
    }
    const tokenIds = await fetchMintedTokenIds(null);
    if (!tokenIds.length) {
      return { entries: [], supplyNow: null };
    }
    const entries = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const [delta, minter] = await Promise.all([
          contract.deltaFromLast(tokenId),
          contract.minterByTokenId(tokenId),
        ]);
        return { tokenId, delta: BigInt(delta), minter };
      })
    );
    entries.sort((a, b) => (a.delta > b.delta ? -1 : a.delta < b.delta ? 1 : 0));
    const sliced = entries.slice(0, MAX_ENTRIES);
    const identityEntries = await Promise.all(
      sliced.map(async (entry) => {
        const identity = entry.minter ? await fetchIdentity(entry.minter) : null;
        return { ...entry, identity };
      })
    );
    const supplyNow = await contract.lessSupplyNow();
    return {
      entries: identityEntries,
      supplyNow: BigInt(supplyNow),
    };
  }

  function renderEntries(entries) {
    const contractInfo = getContractConfig();
    const chain = getChainConfig(contractInfo.chainId);
    listEl.innerHTML = "";
    if (!entries.length) {
      statusEl.textContent = "No mints found yet.";
      return;
    }
    statusEl.textContent = isBuilder
      ? `Showing top ${Math.min(entries.length, MAX_ENTRIES)} Feingehalt mints.`
      : `Showing top ${Math.min(entries.length, MAX_ENTRIES)} tokens.`;
    entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "ui-list-row";

      const label = document.createElement("a");
      const tokenId = entry.tokenId.toString();
      label.href = isBuilder
        ? buildBuilderTokenViewUrl(tokenId) || `/m2/${tokenId}`
        : `/m/${tokenId}`;
      label.textContent = `#${index + 1} · Token ${tokenId}`;
      label.className = "ui-link";

      const identity = entry.identity;
      const entryAddress = isBuilder ? entry.owner : entry.minter;
      const identitySpan = document.createElement("span");
      if (identity?.farcaster?.username) {
        const link = document.createElement("a");
        link.href = identity.farcaster.url || `https://warpcast.com/${identity.farcaster.username}`;
        link.textContent = `@${identity.farcaster.username}`;
        link.className = "ui-link";
        identitySpan.appendChild(link);
      } else if (identity?.ens) {
        const link = document.createElement("a");
        link.href = `https://app.ens.domains/${identity.ens}`;
        link.textContent = identity.ens;
        link.className = "ui-link";
        identitySpan.appendChild(link);
      } else if (entryAddress) {
        const link = document.createElement("a");
        link.href = chain?.explorer
          ? `${chain.explorer}/address/${entryAddress}`
          : `https://etherscan.io/address/${entryAddress}`;
        link.textContent = shortenAddress(entryAddress);
        link.className = "ui-link";
        identitySpan.appendChild(link);
      } else {
        identitySpan.textContent = "—";
      }

      const value = document.createElement("span");
      value.textContent = isBuilder
        ? `Feingehalt ${formatDelta(entry.mintPrice)} ETH`
        : `ΔLESS ${formatDelta(entry.delta)}`;

      row.appendChild(label);
      row.appendChild(identitySpan);
      row.appendChild(value);
      listEl.appendChild(row);
    });
  }

  async function refreshLeaderboard() {
    updateLeaderboardDetails();
    if (!isLeaderboardSupported()) {
      resetList(
        isBuilder
          ? "Builder leaderboard is available on Ethereum Mainnet only."
          : "Leaderboard is available on Ethereum Mainnet only."
      );
      supplyEl.textContent = isBuilder ? "Total minted: —" : "Supply now: —";
      return;
    }
    const contractInfo = getContractConfig();
    if (isZeroAddress(contractInfo.address) || !contractInfo.abi?.length) {
      resetList("Contract not configured.");
      supplyEl.textContent = isBuilder ? "Total minted: —" : "Supply now: —";
      return;
    }
    statusEl.textContent = "Loading leaderboard...";
    try {
      const { entries, supplyNow, totalMinted } = await fetchLeaderboard();
      if (isBuilder) {
        supplyEl.textContent =
          totalMinted === null || totalMinted === undefined
            ? "Total minted: —"
            : `Total minted: ${totalMinted.toString()}`;
      } else {
        supplyEl.textContent =
          supplyNow === null || supplyNow === undefined
            ? "Supply now: —"
            : `Supply now: ${formatDelta(supplyNow)}`;
      }
      renderEntries(entries);
    } catch (error) {
      const message =
        error?.code === "CALL_EXCEPTION" ||
        String(error?.message || "").includes("missing revert data")
          ? "Leaderboard call failed. Ensure your wallet is on Ethereum Mainnet."
          : error?.message || "Unable to load leaderboard.";
      resetList(message);
      supplyEl.textContent = isBuilder ? "Total minted: —" : "Supply now: —";
    }
  }

  function showLeaderboard() {
    refreshLeaderboard();
    mainPanel.classList.add("is-hidden");
    leaderboardPanel.classList.remove("is-hidden");
  }

  function showMain() {
    leaderboardPanel.classList.add("is-hidden");
    mainPanel.classList.remove("is-hidden");
  }

  openButton.addEventListener("click", showLeaderboard);
  backButton.addEventListener("click", showMain);
  landingButton.addEventListener("click", () => {
    showMain();
    document.dispatchEvent(new CustomEvent("open-overlay"));
  });

  document.addEventListener("open-leaderboard", showLeaderboard);

  subscribeWallet((next) => {
    walletState = next;
    updateOpenButtonVisibility();
  });

  subscribeActiveChain(() => {
    readProviderPromise = null;
    updateOpenButtonVisibility();
    if (!leaderboardPanel.classList.contains("is-hidden")) {
      refreshLeaderboard();
    }
  });

  updateOpenButtonVisibility();
}
