import { state } from "../app/app-state.js";
import {
  mapSelectionToFaceTextures,
  downscaleImageToMax,
  getMaxTextureSize,
} from "../app/app-utils.js";
import { fetchMintPriceByTokenId, fetchTokenUri } from "../data/chain/cubixles-reader.js";
import { getProvenance } from "../data/nft/indexer";
import { getCollectionFloorSnapshot } from "../data/nft/floor.js";
import { resolveUri } from "../shared/utils/uri";
import { CUBIXLES_CONTRACT } from "../config/contracts";
import { fetchWithGateways } from "../../../../src/shared/ipfs-fetch.js";
import { metadataSchema, extractRefs } from "../../../../src/shared/schemas/metadata.js";

function parseTokenIdFromPath() {
  const path = window.location.pathname || "";
  const match = path.match(/^\/m\/(\d+)\/?$/);
  if (!match) {
    return null;
  }
  return match[1];
}

function setStatus(message, tone = "neutral") {
  const statusEl = document.getElementById("token-view-status");
  if (!statusEl) {
    return;
  }
  statusEl.classList.remove("is-hidden");
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", tone === "error");
}

function formatEth(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0.0000";
  }
  return value.toFixed(4);
}

function floorKey(contractAddress, tokenId) {
  const address = typeof contractAddress === "string" ? contractAddress.toLowerCase() : "";
  return `${address}:${String(tokenId)}`;
}

function formatTokenId(tokenId) {
  const raw = tokenId == null ? "" : String(tokenId);
  if (raw.length > 8) {
    return `${raw.slice(0, 5)}...${raw.slice(-3)}`;
  }
  return raw || "unknown";
}

function buildOpenSeaAssetUrl(contractAddress, tokenId, chainId) {
  const address = typeof contractAddress === "string" ? contractAddress : "";
  const token = String(tokenId ?? "");
  if (!address || !token) {
    return "";
  }
  const network = chainId === 8453 ? "base" : "ethereum";
  return `https://opensea.io/assets/${network}/${address}/${token}`;
}

function normalizeSnapshotEntries(metadata, refs) {
  const provenanceNfts = metadata?.provenance?.nfts ?? metadata?.references ?? [];
  const byKey = new Map();
  provenanceNfts.forEach((nft) => {
    const key = floorKey(nft?.contractAddress, nft?.tokenId);
    if (!key) {
      return;
    }
    const floorEth =
      typeof nft?.collectionFloorEth === "number" ? nft.collectionFloorEth : 0;
    byKey.set(key, {
      floorEth,
      retrievedAt: nft?.collectionFloorRetrievedAt ?? null,
    });
  });
  return refs.map((ref) => {
    const key = floorKey(ref?.contractAddress, ref?.tokenId);
    const snapshot = byKey.get(key) ?? { floorEth: 0, retrievedAt: null };
    return {
      contractAddress: ref.contractAddress,
      tokenId: ref.tokenId,
      floorEth: snapshot.floorEth,
      retrievedAt: snapshot.retrievedAt,
    };
  });
}

function initFloorPanel() {
  const panel = document.createElement("div");
  panel.id = "token-floor-panel";
  panel.className = "token-floor-panel";
  panel.innerHTML = `
    <div class="token-floor-title">Floor snapshot (mint)</div>
    <div id="token-floor-summary" class="token-floor-summary">Snapshot: 0.0000 ETH</div>
    <div id="token-floor-list" class="ui-floor-list"></div>
    <div class="token-floor-title">Feingehalt (live)</div>
    <div id="token-feingehalt" class="token-floor-summary">Feingehalt: --</div>
    <div id="token-feingehalt-note" class="token-floor-note">Fetching live floors…</div>
  `;
  document.body.appendChild(panel);
  return {
    panel,
    summaryEl: panel.querySelector("#token-floor-summary"),
    listEl: panel.querySelector("#token-floor-list"),
    feingehaltEl: panel.querySelector("#token-feingehalt"),
    feingehaltNoteEl: panel.querySelector("#token-feingehalt-note"),
  };
}

function renderSnapshotFloor(panel, entries, chainId) {
  if (!panel?.summaryEl || !panel?.listEl) {
    return;
  }
  panel.listEl.innerHTML = "";
  let sum = 0;
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "ui-floor-row";
    const label = document.createElement("span");
    const addr = entry.contractAddress
      ? `${entry.contractAddress.slice(0, 6)}…${entry.contractAddress.slice(-4)}`
      : "unknown";
    label.textContent = `${addr} #${formatTokenId(entry.tokenId)}`;
    const value = document.createElement("a");
    const href = buildOpenSeaAssetUrl(entry.contractAddress, entry.tokenId, chainId);
    value.className = "token-floor-link";
    value.href = href || "#";
    value.target = "_blank";
    value.rel = "noreferrer";
    value.textContent = `${formatEth(entry.floorEth)} ETH`;
    row.appendChild(label);
    row.appendChild(value);
    panel.listEl.appendChild(row);
    sum += entry.floorEth;
  });
  panel.summaryEl.textContent = `Snapshot total: ${formatEth(sum)} ETH`;
}

function renderFeingehalt(panel, sum, retrievedAt) {
  if (!panel?.feingehaltEl) {
    return;
  }
  panel.feingehaltEl.textContent = `Feingehalt: ${formatEth(sum)} ETH`;
  if (panel.feingehaltNoteEl) {
    panel.feingehaltNoteEl.textContent = retrievedAt
      ? `Live floors updated ${new Date(retrievedAt).toLocaleString()}`
      : "Live floors unavailable.";
  }
}

async function loadImages(urlSets) {
  if (typeof loadImage !== "function") {
    throw new Error("Image loader unavailable.");
  }
  const maxSize = getMaxTextureSize();
  const loaders = urlSets.map(
    (urls) =>
      new Promise((resolve) => {
        const candidates = Array.isArray(urls) ? urls.filter(Boolean) : [];
        if (!candidates.length) {
          resolve(null);
          return;
        }
        const tryLoad = (index) => {
          if (index >= candidates.length) {
            resolve(null);
            return;
          }
          const url = candidates[index];
          loadImage(
            url,
            (img) => resolve(downscaleImageToMax(img, maxSize)),
            () => tryLoad(index + 1)
          );
        };
        tryLoad(0);
      })
  );
  return Promise.all(loaders);
}

async function resolveMetadataImageCandidates(nft) {
  const candidates = [];
  if (nft?.image?.resolved) {
    candidates.push(nft.image.resolved);
  }
  const tokenUri = nft?.tokenUri?.resolved;
  if (!tokenUri) {
    return candidates;
  }
  try {
    let response;
    if (tokenUri.startsWith("ipfs://")) {
      ({ response } = await fetchWithGateways(tokenUri));
    } else {
      response = await fetch(tokenUri);
    }
    if (!response?.ok) {
      return candidates;
    }
    const metadata = await response.json();
    const imageCandidates = [
      metadata?.image,
      metadata?.image_url,
      metadata?.imageUrl,
    ];
    imageCandidates.forEach((candidate) => {
      if (typeof candidate !== "string" || !candidate.trim()) {
        return;
      }
      const resolved = resolveUri(candidate)?.resolved ?? null;
      if (resolved) {
        candidates.push(resolved);
      }
    });
    if (typeof metadata?.image_data === "string") {
      const svg = metadata.image_data.trim();
      if (!svg) {
        return candidates;
      }
      candidates.push(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    }
  } catch (error) {
    return candidates;
  }
  return Array.from(new Set(candidates));
}

async function waitForFrostedTexture() {
  if (typeof window !== "undefined" && window.__CUBIXLES_SKIP_FROSTED__) {
    return;
  }
  if (state.frostedTexture) {
    return;
  }
  await new Promise((resolve) => {
    const check = () => {
      if (state.frostedTexture) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

function initTokenShareDialog() {
  const modal = document.createElement("div");
  modal.id = "share-modal";
  modal.className = "share-modal is-hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div id="share-backdrop" class="share-backdrop" aria-hidden="true"></div>
      <div class="share-card">
        <div class="share-title">Share this cube</div>
        <div class="share-actions">
        <a id="share-x" class="share-button" target="_blank" rel="noreferrer">X</a>
        <button id="share-copy" class="share-button is-ghost" type="button">Copy link</button>
        </div>
        <button id="share-close" class="share-close" type="button">Close</button>
      </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = "none";

  const backdrop = modal.querySelector("#share-backdrop");
  const closeButton = modal.querySelector("#share-close");
  const copyButton = modal.querySelector("#share-copy");
  const xLink = modal.querySelector("#share-x");

  let currentUrl = "";

  function openShareLink(event) {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }
    if (event?.preventDefault) {
      event.preventDefault();
    }
    if (!xLink?.href) {
      return;
    }
    const opened = window.open(xLink.href, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = xLink.href;
    }
  }

  function closeModal(event) {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }
    if (event?.preventDefault) {
      event.preventDefault();
    }
    modal.classList.add("is-hidden");
    modal.style.display = "none";
  }

  async function copyLink(event) {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }
    if (event?.preventDefault) {
      event.preventDefault();
    }
    if (!currentUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentUrl);
      copyButton.textContent = "Copied!";
    } catch (error) {
      copyButton.textContent = "Copy failed";
    }
    window.setTimeout(() => {
      copyButton.textContent = "Copy link";
    }, 1200);
  }

  function openModal(url) {
    currentUrl = url;
    const encoded = encodeURIComponent(url);
    const text = encodeURIComponent("cubixles_ and curtains");
    xLink.href = `https://twitter.com/intent/tweet?text=${text}&url=${encoded}`;
    modal.classList.remove("is-hidden");
    modal.style.display = "flex";
  }

  backdrop?.addEventListener("click", closeModal);
  closeButton?.addEventListener("click", closeModal);
  copyButton?.addEventListener("click", copyLink);
  backdrop?.addEventListener("pointerdown", closeModal);
  closeButton?.addEventListener("pointerdown", closeModal);
  copyButton?.addEventListener("pointerdown", copyLink);
  xLink?.addEventListener("pointerdown", openShareLink);
  backdrop?.addEventListener("touchstart", closeModal, { passive: false });
  closeButton?.addEventListener("touchstart", closeModal, { passive: false });
  copyButton?.addEventListener("touchstart", copyLink, { passive: false });
  xLink?.addEventListener("touchstart", openShareLink, { passive: false });
  xLink?.addEventListener("click", openShareLink);

  const shareButton = document.createElement("button");
  shareButton.id = "share-cube";
  shareButton.className = "share-cube-button";
  shareButton.type = "button";
  shareButton.textContent = "share cube";
  document.body.appendChild(shareButton);

  function handleShareActivate(event) {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }
    if (event?.preventDefault) {
      event.preventDefault();
    }
    if (!currentUrl) {
      return;
    }
    openModal(currentUrl);
  }

  shareButton.addEventListener("click", handleShareActivate);
  shareButton.addEventListener("pointerdown", handleShareActivate);
  shareButton.addEventListener("touchstart", handleShareActivate, { passive: false });

  return (url) => {
    currentUrl = url;
  };
}


export async function initTokenViewRoute() {
  if (typeof window === "undefined") {
    return false;
  }
  const tokenIdRaw = parseTokenIdFromPath();
  if (!tokenIdRaw) {
    return false;
  }
  document.body.classList.add("is-token-view");
  setStatus("Loading token metadata...");
  const floorPanel = initFloorPanel();
  const setShareUrl = initTokenShareDialog();

  let tokenId;
  try {
    tokenId = BigInt(tokenIdRaw);
  } catch (error) {
    setStatus("Invalid tokenId in URL.", "error");
    return true;
  }

  state.currentCubeTokenId = tokenId;
  document.dispatchEvent(new CustomEvent("cube-token-change"));

  if (typeof setShareUrl === "function") {
    setShareUrl(`${window.location.origin}/m/${tokenId.toString()}`);
  }

  try {
    const mintPrice = await fetchMintPriceByTokenId(tokenId);
    state.tokenMintPriceWei = mintPrice == null ? null : BigInt(mintPrice);
  } catch (error) {
    state.tokenMintPriceWei = null;
  } finally {
    document.dispatchEvent(new CustomEvent("token-mint-price-change"));
  }

  try {
    const tokenUri = await fetchTokenUri(tokenId);
    const resolved = resolveUri(tokenUri);
    if (!resolved?.resolved) {
      throw new Error("Token URI could not be resolved.");
    }
    const { response } = await fetchWithGateways(resolved.resolved);
    if (!response.ok) {
      throw new Error(`Metadata fetch failed (${response.status}).`);
    }
    const metadataJson = await response.json();
    const validation = metadataSchema.safeParse(metadataJson);
    if (!validation.success) {
      throw new Error("Metadata failed schema validation.");
    }
    const refs = extractRefs(validation.data);
    if (!refs.length) {
      throw new Error("No provenance refs found in metadata.");
    }
    const provenanceChainId =
      typeof validation.data?.provenance?.chainId === "number"
        ? validation.data.provenance.chainId
        : CUBIXLES_CONTRACT.chainId;
    const snapshotEntries = normalizeSnapshotEntries(validation.data, refs);
    renderSnapshotFloor(floorPanel, snapshotEntries, provenanceChainId);

    setStatus("Loading referenced NFTs...");
    const nfts = await Promise.all(
      refs.map((ref) =>
        getProvenance(
          ref.contractAddress,
          String(ref.tokenId),
          CUBIXLES_CONTRACT.chainId
        )
      )
    );
    const urlSets = await Promise.all(
      nfts.map((nft) => resolveMetadataImageCandidates(nft))
    );
    if (urlSets.some((urls) => !urls || urls.length === 0)) {
      throw new Error("One or more referenced NFTs are missing images.");
    }
    const images = await loadImages(urlSets);

    await waitForFrostedTexture();
    const fallbackTexture = state.frostedTexture || null;
    const filled = images.map((img) => img || fallbackTexture);
    if (filled.some((img) => !img)) {
      throw new Error("Failed to load NFT images.");
    }
    if (images.some((img) => !img)) {
      console.warn("Some NFT images failed to load; using fallback texture.");
    }

    state.faceTextures = mapSelectionToFaceTextures(filled, state.frostedTexture);
    state.nftSelection = nfts;
    setStatus("Loaded.", "success");

    try {
      const floorCache = new Map();
      const liveFloors = await Promise.all(
        refs.map(async (ref) => {
          const key = String(ref.contractAddress).toLowerCase();
          if (floorCache.has(key)) {
            return floorCache.get(key);
          }
          const result = await getCollectionFloorSnapshot(ref.contractAddress, provenanceChainId);
          floorCache.set(key, result);
          return result;
        })
      );
      const liveSum = liveFloors.reduce((total, entry) => total + (entry?.floorEth || 0), 0);
      const retrievedAt =
        liveFloors.find((entry) => entry?.retrievedAt)?.retrievedAt ?? null;
      renderFeingehalt(floorPanel, liveSum, retrievedAt);
    } catch (error) {
      renderFeingehalt(floorPanel, 0, null);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load token.";
    setStatus(message, "error");
  }

  return true;
}
