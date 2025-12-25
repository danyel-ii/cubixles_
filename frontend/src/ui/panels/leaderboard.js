import { BrowserProvider, Contract, id } from "ethers";
import { ICECUBE_CONTRACT } from "../../config/contracts";
import { subscribeWallet } from "../../features/wallet/wallet.js";

const MAX_ENTRIES = 50;
const SEPOLIA_CHAIN_ID = 11155111;
const WAD = 1_000_000_000_000_000_000n;

function formatDelta(value) {
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

export function initLeaderboardUi() {
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

  function formatChain(chainId) {
    if (chainId === 11155111) {
      return "Sepolia";
    }
    if (chainId === 1) {
      return "Ethereum Mainnet";
    }
    return `Chain ${chainId}`;
  }

  function updateLeaderboardDetails() {
    contractEl.textContent = `Contract: ${ICECUBE_CONTRACT.address}`;
    chainEl.textContent = `Chain: ${formatChain(ICECUBE_CONTRACT.chainId)}`;
    updatedEl.textContent = `Last updated: ${new Date().toISOString()}`;
  }

  function resetList(message) {
    statusEl.textContent = message;
    listEl.innerHTML = "";
  }

  async function fetchMintedTokenIds(provider) {
    const browserProvider = new BrowserProvider(provider);
    const contract = new Contract(
      ICECUBE_CONTRACT.address,
      ICECUBE_CONTRACT.abi,
      browserProvider
    );
    const topic = id("Minted(uint256,address,bytes32,bytes32)");
    const logs = await browserProvider.getLogs({
      address: ICECUBE_CONTRACT.address,
      fromBlock: 0,
      toBlock: "latest",
      topics: [topic],
    });
    const tokenIds = [];
    logs.forEach((log) => {
      try {
        const parsed = contract.interface.parseLog(log);
        const tokenId = parsed?.args?.tokenId;
        if (tokenId !== null && tokenId !== undefined) {
          tokenIds.push(BigInt(tokenId));
        }
      } catch (error) {
        return;
      }
    });
    return [...new Set(tokenIds.map((id) => id.toString()))].map((id) => BigInt(id));
  }

  async function fetchLeaderboard(provider) {
    const browserProvider = new BrowserProvider(provider);
    const network = await browserProvider.getNetwork();
    if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
      throw new Error("Switch wallet to Sepolia to view leaderboard.");
    }
    const contract = new Contract(
      ICECUBE_CONTRACT.address,
      ICECUBE_CONTRACT.abi,
      browserProvider
    );
    const tokenIds = await fetchMintedTokenIds(provider);
    if (!tokenIds.length) {
      return { entries: [], supplyNow: null };
    }
    const entries = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const delta = await contract.deltaFromLast(tokenId);
        return { tokenId, delta: BigInt(delta) };
      })
    );
    entries.sort((a, b) => (a.delta > b.delta ? -1 : a.delta < b.delta ? 1 : 0));
    const supplyNow = await contract.lessSupplyNow();
    return {
      entries: entries.slice(0, MAX_ENTRIES),
      supplyNow: BigInt(supplyNow),
    };
  }

  function renderEntries(entries) {
    listEl.innerHTML = "";
    if (!entries.length) {
      statusEl.textContent = "No mints found yet.";
      return;
    }
    statusEl.textContent = `Showing top ${Math.min(entries.length, MAX_ENTRIES)} tokens.`;
    entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "ui-list-row";

      const label = document.createElement("span");
      label.textContent = `#${index + 1} · Token ${entry.tokenId.toString()}`;

      const value = document.createElement("span");
      value.textContent = `ΔLESS ${formatDelta(entry.delta)}`;

      row.appendChild(label);
      row.appendChild(value);
      listEl.appendChild(row);
    });
  }

  async function refreshLeaderboard() {
    updateLeaderboardDetails();
    if (!walletState || walletState.status !== "connected") {
      resetList("Connect your wallet to load the leaderboard.");
      supplyEl.textContent = "Supply now: —";
      return;
    }
    if (isZeroAddress(ICECUBE_CONTRACT.address) || !ICECUBE_CONTRACT.abi?.length) {
      resetList("Contract not configured.");
      supplyEl.textContent = "Supply now: —";
      return;
    }
    statusEl.textContent = "Loading leaderboard...";
    try {
      const { entries, supplyNow } = await fetchLeaderboard(walletState.provider);
      supplyEl.textContent = supplyNow
        ? `Supply now: ${formatDelta(supplyNow)}`
        : "Supply now: —";
      renderEntries(entries);
    } catch (error) {
      resetList(error?.message || "Unable to load leaderboard.");
      supplyEl.textContent = "Supply now: —";
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
  });
}
