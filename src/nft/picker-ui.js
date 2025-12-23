import { getNftsForOwner } from "./indexer";
import { subscribeWallet } from "../wallet/wallet";
import { state } from "../app/app-state.js";
import { fillFaceTextures } from "../app/app-utils.js";

const CHAIN_ID = 11155111;
const MAX_SELECTION = 3;

function buildKey(nft) {
  return `${nft.contractAddress}:${nft.tokenId}`;
}

function safeText(value, fallback) {
  if (value && value.trim()) {
    return value;
  }
  return fallback;
}

export function initNftPickerUi() {
  const statusEl = document.getElementById("nft-status");
  const selectionEl = document.getElementById("nft-selection");
  const gridEl = document.getElementById("nft-grid");
  const refreshButton = document.getElementById("nft-refresh");
  const clearButton = document.getElementById("nft-clear");
  const applyButton = document.getElementById("nft-apply");

  if (
    !statusEl ||
    !selectionEl ||
    !gridEl ||
    !refreshButton ||
    !clearButton ||
    !applyButton
  ) {
    return;
  }

  let inventory = [];
  let selectedKeys = new Set();
  let currentAddress = null;
  let isLoading = false;

  function setStatus(message, tone = "neutral") {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", tone === "error");
    statusEl.classList.toggle("is-success", tone === "success");
  }

  function setLoading(loading) {
    isLoading = loading;
    refreshButton.disabled = loading || !currentAddress;
    clearButton.disabled = selectedKeys.size === 0 || loading;
    applyButton.disabled = selectedKeys.size !== MAX_SELECTION || loading;
  }

  function updateSelection() {
    const selection = inventory.filter((nft) => selectedKeys.has(buildKey(nft)));
    state.nftSelection = selection;
    selectionEl.textContent = `Selected ${selection.length} / ${MAX_SELECTION}`;
    clearButton.disabled = selection.length === 0 || isLoading;
    applyButton.disabled = selection.length !== MAX_SELECTION || isLoading;
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("nft-selection-change"));
    }
  }

  function renderInventory() {
    gridEl.innerHTML = "";
    if (!inventory.length) {
      return;
    }

    const fragment = document.createDocumentFragment();
    inventory.forEach((nft) => {
      const key = buildKey(nft);
      const isSelected = selectedKeys.has(key);
      const isDisabled = !isSelected && selectedKeys.size >= MAX_SELECTION;

      const card = document.createElement("button");
      card.type = "button";
      card.className = "nft-card";
      card.dataset.key = key;
      if (isSelected) {
        card.classList.add("is-selected");
      }
      if (isDisabled) {
        card.disabled = true;
      }

      const thumb = document.createElement("div");
      thumb.className = "nft-thumb";
      if (nft.image?.resolved) {
        const img = document.createElement("img");
        img.alt = safeText(nft.name, "NFT image");
        img.src = nft.image.resolved;
        img.loading = "lazy";
        thumb.appendChild(img);
      } else {
        const empty = document.createElement("div");
        empty.className = "nft-empty";
        empty.textContent = "No image";
        thumb.appendChild(empty);
      }

      const title = document.createElement("div");
      title.className = "nft-title";
      title.textContent = safeText(nft.name, "Untitled NFT");

      const meta = document.createElement("div");
      meta.className = "nft-meta";
      const collection = safeText(nft.collectionName, "Unknown collection");
      meta.textContent = `#${nft.tokenId} / ${collection}`;

      card.appendChild(thumb);
      card.appendChild(title);
      card.appendChild(meta);

      card.addEventListener("click", () => {
        if (selectedKeys.has(key)) {
          selectedKeys.delete(key);
        } else if (selectedKeys.size < MAX_SELECTION) {
          selectedKeys.add(key);
        } else {
          setStatus("Selection is limited to 3 NFTs.", "error");
          return;
        }
        updateSelection();
        renderInventory();
        if (selectedKeys.size === MAX_SELECTION) {
          setStatus("Selection ready.", "success");
        } else {
          setStatus("Select exactly 3 NFTs to continue.");
        }
      });

      fragment.appendChild(card);
    });

    gridEl.appendChild(fragment);
  }

  async function loadInventory(address) {
    setLoading(true);
    setStatus("Loading Sepolia NFTs...");
    state.nftStatus = "loading";
    state.nftError = null;
    try {
      const nfts = await getNftsForOwner(address, CHAIN_ID);
      inventory = nfts;
      state.nftInventory = nfts;
      state.nftStatus = "ready";
      const validKeys = new Set(nfts.map((nft) => buildKey(nft)));
      selectedKeys = new Set([...selectedKeys].filter((key) => validKeys.has(key)));
      if (!nfts.length) {
        setStatus("No Sepolia NFTs found for this wallet.");
      } else {
        setStatus("Select exactly 3 NFTs to continue.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load NFTs.";
      inventory = [];
      state.nftInventory = [];
      state.nftStatus = "error";
      state.nftError = message;
      setStatus(message, "error");
    } finally {
      setLoading(false);
      updateSelection();
      renderInventory();
    }
  }

  function resolveSelectedImages(selection) {
    const urls = selection.map((nft) => nft.image?.resolved ?? null);
    if (urls.some((url) => !url)) {
      return null;
    }
    return urls;
  }

  function loadImages(urls) {
    if (typeof loadImage !== "function") {
      return Promise.reject(new Error("Image loader unavailable."));
    }
    const loaders = urls.map(
      (url) =>
        new Promise((resolve) => {
          loadImage(
            url,
            (img) => resolve(img),
            () => resolve(null)
          );
        })
    );
    return Promise.all(loaders);
  }

  refreshButton.addEventListener("click", () => {
    if (currentAddress && !isLoading) {
      loadInventory(currentAddress);
    }
  });

  clearButton.addEventListener("click", () => {
    selectedKeys = new Set();
    updateSelection();
    renderInventory();
    if (inventory.length) {
      setStatus("Select exactly 3 NFTs to continue.");
    }
  });

  applyButton.addEventListener("click", async () => {
    const selection = inventory.filter((nft) => selectedKeys.has(buildKey(nft)));
    if (selection.length !== MAX_SELECTION) {
      setStatus("Select exactly 3 NFTs to continue.", "error");
      return;
    }
    const imageUrls = resolveSelectedImages(selection);
    if (!imageUrls) {
      setStatus("One or more NFTs are missing images.", "error");
      return;
    }
    setLoading(true);
    setStatus("Applying NFTs to cube...");
    try {
      const images = await loadImages(imageUrls);
      const usable = images.filter((img) => img);
      if (usable.length !== imageUrls.length) {
        throw new Error("Failed to load one or more NFT images.");
      }
      state.faceTextures = fillFaceTextures(usable);
      state.selectedDataUrls = imageUrls;
      setStatus("NFTs applied to cube.", "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to apply NFTs.";
      setStatus(message, "error");
    } finally {
      setLoading(false);
      updateSelection();
      renderInventory();
    }
  });

  subscribeWallet((walletState) => {
    if (walletState?.status === "connected" && walletState.address) {
      if (currentAddress !== walletState.address) {
        currentAddress = walletState.address;
        loadInventory(currentAddress);
      }
      refreshButton.disabled = isLoading;
      return;
    }

    currentAddress = null;
    inventory = [];
    selectedKeys = new Set();
    state.nftInventory = [];
    state.nftSelection = [];
    state.nftStatus = "idle";
    state.nftError = null;
    setStatus("Connect your wallet to load Sepolia NFTs.");
    updateSelection();
    renderInventory();
    setLoading(false);
  });

  setStatus("Connect your wallet to load Sepolia NFTs.");
  updateSelection();
}
