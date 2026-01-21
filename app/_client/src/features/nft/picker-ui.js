import { getNftsForOwner } from "../../data/nft/indexer";
import { CUBIXLES_CONTRACT } from "../../config/contracts";
import { formatChainName, subscribeActiveChain } from "../../config/chains.js";
import { subscribeWallet } from "../wallet/wallet.js";
import { state } from "../../app/app-state.js";
import {
  fillFaceTextures,
  mapSelectionToFaceTextures,
  downscaleImageToMax,
  getMaxTextureSize,
} from "../../app/app-utils.js";
import { buildImageCandidates } from "../../shared/utils/uri";
import { isAllowedNftUri } from "src/shared/uri-policy.js";

const MAX_SELECTION = 6;

function buildKey(nft) {
  return `${nft.contractAddress}:${nft.tokenId}`;
}

function safeText(value, fallback) {
  if (value && value.trim()) {
    return value;
  }
  return fallback;
}

function normalizeTokenType(tokenType) {
  if (!tokenType) {
    return "";
  }
  const normalized = String(tokenType).trim().toUpperCase();
  if (normalized === "ERC721") {
    return "ERC-721";
  }
  if (normalized === "ERC1155") {
    return "ERC-1155";
  }
  return normalized;
}

function isErc1155(nft) {
  return normalizeTokenType(nft?.tokenType) === "ERC-1155";
}

function getNftIssues(nft) {
  const issues = [];
  const erc1155 = isErc1155(nft);
  if (erc1155) {
    issues.push("ERC-1155 (ERC-721 only)");
  }
  const imageCandidates = buildImageCandidates(nft?.image);
  const hasImage = imageCandidates.length > 0;
  const imageUri = nft?.image?.original;
  if (!hasImage) {
    issues.push("no image");
  } else if (imageUri && !isAllowedNftUri(imageUri)) {
    issues.push("image not allowed");
  }
  const hasMetadata = Boolean(nft?.metadataAvailable);
  const metadataUri = nft?.tokenUri?.original;
  if (!hasMetadata) {
    issues.push("no metadata");
  } else if (metadataUri && !isAllowedNftUri(metadataUri)) {
    issues.push("metadata not allowed");
  }
  return { issues, hasImage, hasMetadata, isErc1155: erc1155 };
}

function isBlockedNft(nft) {
  const { hasImage, hasMetadata, isErc1155: erc1155 } = getNftIssues(nft);
  return erc1155 || !hasImage || !hasMetadata;
}

function formatBlockedMessage(erc1155Count, mediaCount) {
  const messages = [];
  if (erc1155Count > 0) {
    const suffix = erc1155Count === 1 ? "NFT" : "NFTs";
    messages.push(`Blocked ${erc1155Count} ERC-1155 ${suffix} (ERC-721 only).`);
  }
  if (mediaCount > 0) {
    const suffix = mediaCount === 1 ? "NFT" : "NFTs";
    messages.push(`Blocked ${mediaCount} ${suffix} without resolvable images or metadata.`);
  }
  return messages.join(" ");
}

function formatIssueMessage(nft, issues) {
  const name = safeText(nft?.name, "NFT");
  const suffix = issues.join(", ");
  return `Warning: ${name} #${nft?.tokenId ?? "?"} has ${suffix}.`;
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
  let selectedOrder = [];
  let currentAddress = null;
  let isLoading = false;
  let appliedSelectionKey = null;
  let isWalletConnected = false;
  let activeChainId = CUBIXLES_CONTRACT.chainId;
  let blockedMediaCount = 0;
  let blockedStandardCount = 0;

  function setStatus(message, tone = "neutral") {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", tone === "error");
    statusEl.classList.toggle("is-success", tone === "success");
  }

  function setLoading(loading) {
    isLoading = loading;
    refreshButton.disabled = loading || !currentAddress;
    clearButton.disabled = selectedKeys.size === 0 || loading;
    applyButton.disabled = selectedKeys.size < 1 || selectedKeys.size > MAX_SELECTION || loading;
    updateApplyGlow();
  }

  function getSelectionKey() {
    if (!selectedOrder.length) {
      return "";
    }
    return selectedOrder.join("|");
  }

  function updateApplyGlow() {
    const hasSelection = selectedKeys.size > 0;
    const selectionKey = getSelectionKey();
    const isApplied = appliedSelectionKey && appliedSelectionKey === selectionKey;
    applyButton.classList.toggle(
      "is-glow-turquoise",
      isWalletConnected && hasSelection && !isApplied
    );
  }

  function updateSelection() {
    const inventoryMap = new Map(inventory.map((nft) => [buildKey(nft), nft]));
    selectedOrder = selectedOrder.filter((key) => selectedKeys.has(key) && inventoryMap.has(key));
    const selection = selectedOrder.map((key) => inventoryMap.get(key));
    state.nftSelection = selection;
    selectionEl.textContent = `Selected ${selection.length} / ${MAX_SELECTION}`;
    selectionEl.classList.remove("is-hidden");
    if (typeof document !== "undefined" && !document.body.classList.contains("is-preview")) {
      document.getElementById("ui")?.classList.remove("is-hidden");
    }
    clearButton.disabled = selection.length === 0 || isLoading;
    applyButton.disabled =
      selection.length < 1 || selection.length > MAX_SELECTION || isLoading;
    const selectionKey = getSelectionKey();
    if (appliedSelectionKey && appliedSelectionKey !== selectionKey) {
      appliedSelectionKey = null;
    }
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("nft-selection-change"));
    }
    updateApplyGlow();
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
      const { issues, hasImage, hasMetadata, isErc1155: erc1155 } = getNftIssues(nft);
      const isBlocked = erc1155 || !hasImage || !hasMetadata;

      const card = document.createElement("button");
      card.type = "button";
      card.className = "nft-card";
      card.dataset.key = key;
      if (isSelected) {
        card.classList.add("is-selected");
      }
      if (issues.length) {
        card.classList.add("is-warning");
        card.title = `Warning: ${issues.join(", ")}.`;
      }
      if (isDisabled || isBlocked) {
        card.disabled = true;
      }

      const thumb = document.createElement("div");
      thumb.className = "nft-thumb";
      if (nft.image?.resolved) {
        const candidates = buildImageCandidates(nft.image);
        const img = document.createElement("img");
        img.alt = safeText(nft.name, "NFT image");
        img.src = candidates[0] || nft.image.resolved;
        if (candidates.length > 1) {
          img.addEventListener(
            "error",
            () => {
              if (img.src !== candidates[1]) {
                img.src = candidates[1];
              }
            },
            { once: true }
          );
        }
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

      if (issues.length) {
        const warning = document.createElement("div");
        warning.className = "nft-warning";
        warning.textContent = issues.join(" • ");
        card.appendChild(warning);
      }

      card.addEventListener("click", () => {
        if (selectedKeys.has(key)) {
          selectedKeys.delete(key);
          selectedOrder = selectedOrder.filter((item) => item !== key);
        } else if (selectedKeys.size < MAX_SELECTION) {
          selectedKeys.add(key);
          selectedOrder.push(key);
        } else {
          setStatus("Selection is limited to 6 NFTs.", "error");
          return;
        }
        updateSelection();
        renderInventory();
        if (selectedKeys.has(key) && issues.length) {
          setStatus(
            `${formatIssueMessage(nft, issues)} Consider choosing NFTs with supported metadata.`,
            "error"
          );
          return;
        }
        if (selectedKeys.size >= 1) {
          setStatus("Selection ready.", "success");
          return;
        }
        if (blockedMediaCount > 0 || blockedStandardCount > 0) {
          setStatus(formatBlockedMessage(blockedStandardCount, blockedMediaCount), "error");
          return;
        }
        setStatus("Select 1 to 6 NFTs to continue.");
      });

      fragment.appendChild(card);
    });

    gridEl.appendChild(fragment);
  }

  async function loadInventory(address) {
    const fallbackInventory = inventory;
    const fallbackSelectedKeys = new Set(selectedKeys);
    const fallbackSelectedOrder = [...selectedOrder];
    setLoading(true);
    setStatus(`Loading ${formatChainName(CUBIXLES_CONTRACT.chainId)} NFTs...`);
    state.nftStatus = "loading";
    state.nftError = null;
    try {
      const nfts = await getNftsForOwner(address, CUBIXLES_CONTRACT.chainId);
      inventory = nfts;
      state.nftInventory = nfts;
      state.nftStatus = "ready";
      appliedSelectionKey = null;
      const blockedMedia = nfts.filter((nft) => {
        const { hasImage, hasMetadata } = getNftIssues(nft);
        return !hasImage || !hasMetadata;
      });
      blockedMediaCount = blockedMedia.length;
      blockedStandardCount = nfts.filter((nft) => isErc1155(nft)).length;
      const validNfts = nfts.filter((nft) => !isBlockedNft(nft));
      const validKeys = new Set(validNfts.map((nft) => buildKey(nft)));
      selectedKeys = new Set([...selectedKeys].filter((key) => validKeys.has(key)));
      selectedOrder = selectedOrder.filter((key) => validKeys.has(key));
      if (typeof window !== "undefined" && window.__CUBIXLES_TEST_HOOKS__) {
        const candidate = validNfts[0] || nfts[0];
        if (selectedKeys.size === 0 && candidate) {
          const firstKey = buildKey(candidate);
          selectedKeys.add(firstKey);
          selectedOrder = [firstKey];
        }
      }
      if (!nfts.length) {
        setStatus(
          `No ${formatChainName(CUBIXLES_CONTRACT.chainId)} NFTs found for this wallet.`
        );
      } else if (blockedMediaCount > 0 || blockedStandardCount > 0) {
        setStatus(formatBlockedMessage(blockedStandardCount, blockedMediaCount), "error");
      } else {
        setStatus("Select 1 to 6 NFTs to continue.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load NFTs.";
      if (fallbackInventory.length) {
        inventory = fallbackInventory;
        selectedKeys = fallbackSelectedKeys;
        selectedOrder = fallbackSelectedOrder;
        state.nftInventory = fallbackInventory;
      } else {
        inventory = [];
        state.nftInventory = [];
      }
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
    const urlSets = selection.map((nft) => buildImageCandidates(nft.image));
    if (urlSets.some((urls) => !urls.length)) {
      return null;
    }
    return urlSets;
  }

  function loadImages(urls) {
    if (typeof loadImage !== "function") {
      return Promise.reject(new Error("Image loader unavailable."));
    }
    const maxSize = getMaxTextureSize();
    const loaders = urls.map((urlSet) => {
      const candidates = Array.isArray(urlSet) ? urlSet.filter(Boolean) : [urlSet];
      const cachedUrl = candidates.find((url) => state.textureCache.has(url));
      if (cachedUrl) {
        return Promise.resolve({ image: state.textureCache.get(cachedUrl), url: cachedUrl });
      }
      return new Promise((resolve) => {
        const tryLoad = (index) => {
          if (index >= candidates.length) {
            resolve(null);
            return;
          }
          const url = candidates[index];
          loadImage(
            url,
            (img) => {
              const scaled = downscaleImageToMax(img, maxSize);
              state.textureCache.set(url, scaled);
              resolve({ image: scaled, url });
            },
            () => tryLoad(index + 1)
          );
        };
        tryLoad(0);
      });
    });
    return Promise.all(loaders);
  }

  refreshButton.addEventListener("click", () => {
    if (currentAddress && !isLoading) {
      loadInventory(currentAddress);
    }
  });

  subscribeActiveChain((chainId) => {
    if (chainId === activeChainId) {
      return;
    }
    activeChainId = chainId;
    selectedKeys = new Set();
    selectedOrder = [];
    appliedSelectionKey = null;
    state.nftSelection = [];
    updateSelection();
    if (currentAddress) {
      void loadInventory(currentAddress);
      return;
    }
    inventory = [];
    state.nftInventory = [];
    state.nftStatus = "idle";
    renderInventory();
    setStatus(`Connect your wallet to load ${formatChainName(chainId)} NFTs.`);
  });

  clearButton.addEventListener("click", () => {
    selectedKeys = new Set();
    selectedOrder = [];
    appliedSelectionKey = null;
    updateSelection();
    renderInventory();
    if (inventory.length) {
      if (blockedMediaCount > 0 || blockedStandardCount > 0) {
        setStatus(formatBlockedMessage(blockedStandardCount, blockedMediaCount), "error");
      } else {
        setStatus("Select 1 to 6 NFTs to continue.");
      }
    }
  });

  applyButton.addEventListener("click", async () => {
    applyButton.classList.add("is-hooked");
    const selection = state.nftSelection;
    if (selection.length < 1 || selection.length > MAX_SELECTION) {
      setStatus("Select 1 to 6 NFTs to continue.", "error");
      return;
    }
    const selectionKey = getSelectionKey();
    const imageUrls = resolveSelectedImages(selection);
    if (!imageUrls) {
      setStatus("One or more NFTs are missing images.", "error");
      return;
    }
    setLoading(true);
    state.isLoadingLocal = true;
    setStatus("Applying NFTs to cube...");
    try {
      const images = await loadImages(imageUrls);
      const usable = images.map((item) => item?.image).filter((img) => img);
      if (usable.length !== imageUrls.length) {
        throw new Error("Failed to load one or more NFT images.");
      }
      const faceTextures = mapSelectionToFaceTextures(usable, state.frostedTexture);
      state.faceTextures = faceTextures;
      const appliedUrls = images.map((item) => item?.url).filter(Boolean);
      if (appliedUrls.length !== imageUrls.length) {
        throw new Error("Failed to resolve NFT image URLs.");
      }
      state.selectedDataUrls = appliedUrls;
      setStatus("NFTs applied to cube.", "success");
      appliedSelectionKey = selectionKey;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to apply NFTs.";
      setStatus(message, "error");
    } finally {
      state.isLoadingLocal = false;
      setLoading(false);
      updateSelection();
      renderInventory();
    }
  });

  subscribeWallet((walletState) => {
    if (walletState?.status === "connected" && walletState.address) {
      isWalletConnected = true;
      if (currentAddress !== walletState.address) {
        currentAddress = walletState.address;
        appliedSelectionKey = null;
        loadInventory(currentAddress);
      }
      refreshButton.disabled = isLoading;
      updateApplyGlow();
      return;
    }

    isWalletConnected = false;
    currentAddress = null;
    applyButton.classList.remove("is-hooked");
    inventory = [];
    selectedKeys = new Set();
    selectedOrder = [];
    appliedSelectionKey = null;
    blockedMediaCount = 0;
    blockedStandardCount = 0;
    state.nftInventory = [];
    state.nftSelection = [];
    state.nftStatus = "idle";
    state.nftError = null;
    setStatus(
      `Connect your wallet to load ${formatChainName(CUBIXLES_CONTRACT.chainId)} NFTs.`
    );
    updateSelection();
    renderInventory();
    setLoading(false);
  });

  setStatus(
    `Connect your wallet to load ${formatChainName(CUBIXLES_CONTRACT.chainId)} NFTs.`
  );
  updateSelection();
  updateApplyGlow();
}
