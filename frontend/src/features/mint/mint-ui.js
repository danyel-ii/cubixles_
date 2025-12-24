import { BrowserProvider, Contract, parseEther } from "ethers";
import { ICECUBE_CONTRACT } from "../../config/contracts";
import { buildProvenanceBundle } from "../../data/nft/indexer";
import { getCollectionFloorSnapshot } from "../../data/nft/floor.js";
import { subscribeWallet } from "../wallet/wallet.js";
import { state } from "../../app/app-state.js";
import {
  buildMintMetadata,
  getMintAnimationUrl,
} from "./mint-metadata.js";
import { buildTokenUri } from "./token-uri-provider.js";

const SEPOLIA_CHAIN_ID = 11155111;
const MINT_PRICE = 0.0017;
const IS_DEV = Boolean(import.meta?.env?.DEV);

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Mint failed.";
}

function isZeroAddress(address) {
  return !address || address === "0x0000000000000000000000000000000000000000";
}

export function initMintUi() {
  const statusEl = document.getElementById("mint-status");
  const mintButton = document.getElementById("mint-submit");
  const amountInput = document.getElementById("mint-payment");
  const floorSummaryEl = document.getElementById("mint-floor-summary");
  const floorListEl = document.getElementById("mint-floor-list");

  if (!statusEl || !mintButton || !amountInput) {
    return;
  }

  let walletState = null;
  const devChecklist = IS_DEV ? initDevChecklist(statusEl.parentElement) : null;
  const floorCache = new Map();

  function setStatus(message, tone = "neutral") {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", tone === "error");
    statusEl.classList.toggle("is-success", tone === "success");
  }

  function setDisabled(disabled) {
    mintButton.disabled = disabled;
    amountInput.disabled = disabled;
  }

  function formatEth(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "0.0000";
    }
    return value.toFixed(4);
  }

  async function refreshFloorSnapshot() {
    if (!floorSummaryEl || !floorListEl) {
      return;
    }
    const selection = state.nftSelection;
    if (!selection.length) {
      floorSummaryEl.textContent = "Total floor (snapshot): 0.0000 ETH";
      floorListEl.textContent = "Select NFTs to view floor snapshot.";
      return;
    }

    const uniqueContracts = new Map();
    selection.forEach((nft) => {
      if (!uniqueContracts.has(nft.contractAddress)) {
        uniqueContracts.set(nft.contractAddress, nft.chainId);
      }
    });

    await Promise.all(
      [...uniqueContracts.entries()].map(async ([contract, chainId]) => {
        if (floorCache.has(contract)) {
          return;
        }
        const snapshot = await getCollectionFloorSnapshot(contract, chainId);
        floorCache.set(contract, snapshot);
      })
    );

    let sumFloor = 0;
    floorListEl.innerHTML = "";
    selection.forEach((nft) => {
      const snapshot = floorCache.get(nft.contractAddress) ?? {
        floorEth: 0,
        retrievedAt: null,
      };
      nft.collectionFloorEth = snapshot.floorEth;
      nft.collectionFloorRetrievedAt = snapshot.retrievedAt;
      sumFloor += snapshot.floorEth;

      const row = document.createElement("div");
      row.className = "ui-floor-row";

      const label = document.createElement("span");
      const collection = nft.collectionName || "Unknown collection";
      label.textContent = `${collection} #${nft.tokenId}`;

      const value = document.createElement("span");
      value.textContent = `${formatEth(snapshot.floorEth)} ETH`;

      row.appendChild(label);
      row.appendChild(value);
      floorListEl.appendChild(row);
    });

    floorSummaryEl.textContent = `Total floor (snapshot): ${formatEth(sumFloor)} ETH`;
  }

  function updateEligibility() {
    if (!walletState || walletState.status !== "connected") {
      setStatus("Connect your wallet to mint.");
      setDisabled(true);
      return;
    }
    if (isZeroAddress(ICECUBE_CONTRACT.address)) {
      setStatus("Deploy contract and update address before minting.", "error");
      setDisabled(true);
      return;
    }
    if (state.nftSelection.length < 1 || state.nftSelection.length > 6) {
      setStatus("Select 1 to 6 NFTs to mint.");
      setDisabled(true);
      return;
    }
    if (!ICECUBE_CONTRACT.abi || ICECUBE_CONTRACT.abi.length === 0) {
      setStatus("ABI missing. Run export-abi before minting.", "error");
      setDisabled(true);
      return;
    }
    if (!getMintAnimationUrl()) {
      setStatus("Set VITE_APP_ANIMATION_URL before minting.", "error");
      setDisabled(true);
      return;
    }
    setStatus("Ready to mint.");
    setDisabled(false);
  }

  subscribeWallet((next) => {
    walletState = next;
    updateEligibility();
  });

  document.addEventListener("nft-selection-change", () => {
    updateEligibility();
    refreshFloorSnapshot();
  });

  mintButton.addEventListener("click", async () => {
    if (!walletState || walletState.status !== "connected") {
      setStatus("Connect your wallet to mint.", "error");
      return;
    }
    if (state.nftSelection.length < 1 || state.nftSelection.length > 6) {
      setStatus("Select 1 to 6 NFTs to mint.", "error");
      return;
    }
    setDisabled(true);
    setStatus("Building provenance bundle...");
    try {
      await refreshFloorSnapshot();
      const provider = new BrowserProvider(walletState.provider);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        throw new Error("Switch wallet to Sepolia.");
      }
      const signer = await provider.getSigner();
      const contract = new Contract(
        ICECUBE_CONTRACT.address,
        ICECUBE_CONTRACT.abi,
        signer
      );
      const bundle = await buildProvenanceBundle(
        state.nftSelection,
        walletState.address,
        SEPOLIA_CHAIN_ID
      );
      const metadata = buildMintMetadata(state.nftSelection, bundle);
      const tokenUri = buildTokenUri(metadata);
      if (devChecklist) {
        const diagnostics = buildDiagnostics({
          selection: state.nftSelection,
          metadata,
          tokenUri,
          amountInput: amountInput.value,
          walletAddress: walletState.address,
        });
        logDiagnostics(diagnostics, devChecklist);
      }
      const refs = state.nftSelection.map((nft) => ({
        contractAddress: nft.contractAddress,
        tokenId: BigInt(nft.tokenId),
      }));
      const valueRaw = amountInput.value.trim();
      const overrides = valueRaw ? { value: parseEther(valueRaw) } : {};

      setStatus("Submitting mint transaction...");
      const tx = await contract.mint(tokenUri, refs, overrides);
      setStatus("Waiting for confirmation...");
      await tx.wait();
      setStatus("Mint confirmed.", "success");
    } catch (error) {
      setStatus(formatError(error), "error");
    } finally {
      setDisabled(false);
      updateEligibility();
    }
  });

  if (!amountInput.value) {
    amountInput.value = MINT_PRICE.toFixed(6);
  }

  updateEligibility();
  refreshFloorSnapshot();
}

function buildDiagnostics({ selection, metadata, tokenUri, amountInput, walletAddress }) {
  const sumFloorEth = selection.reduce((total, nft) => {
    if (typeof nft.collectionFloorEth !== "number" || Number.isNaN(nft.collectionFloorEth)) {
      return total;
    }
    return total + nft.collectionFloorEth;
  }, 0);

  return {
    walletAddress,
    selectionCount: selection.length,
    economics: {
      mintPriceEth: MINT_PRICE,
      sumFloorEth,
      amountInputEth: amountInput ? Number(amountInput) : null,
    },
    uris: {
      animationUrl: metadata.animation_url || null,
      image: metadata.image || null,
      tokenUri,
    },
  };
}

function logDiagnostics(diagnostics, devChecklist) {
  console.info("[icecube][mint] economics", diagnostics.economics);
  devChecklist.mark("economics");
  console.info("[icecube][mint] uris", diagnostics.uris);
  devChecklist.mark("uris");
  devChecklist.setPayload(diagnostics);
}

function initDevChecklist(container) {
  if (!container) {
    return {
      mark: () => {},
      setPayload: () => {},
    };
  }

  const section = document.createElement("div");
  section.className = "ui-section";

  const title = document.createElement("div");
  title.className = "ui-section-title";
  title.textContent = "Dev checklist";
  section.appendChild(title);

  const list = document.createElement("ul");
  list.style.margin = "8px 0 0";
  list.style.padding = "0 0 0 18px";

  const items = [
    { id: "economics", label: "Economics breakdown logged" },
    { id: "uris", label: "Final URIs logged" },
    { id: "copy", label: "Diagnostics copied" },
  ];

  const itemMap = new Map();
  items.forEach((item) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = item.label;
    li.appendChild(label);
    list.appendChild(li);
    itemMap.set(item.id, li);
  });

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ui-button is-ghost";
  button.textContent = "Copy diagnostics";
  button.style.marginTop = "10px";

  section.appendChild(list);
  section.appendChild(button);
  container.appendChild(section);

  let payload = null;

  function mark(id) {
    const item = itemMap.get(id);
    if (item && item.dataset.done !== "true") {
      item.textContent = `${item.textContent} (done)`;
      item.dataset.done = "true";
    }
  }

  async function copyDiagnostics() {
    if (!payload) {
      return;
    }
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      mark("copy");
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        mark("copy");
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  button.addEventListener("click", () => {
    copyDiagnostics();
  });

  return {
    mark,
    setPayload(next) {
      payload = next;
    },
  };
}
