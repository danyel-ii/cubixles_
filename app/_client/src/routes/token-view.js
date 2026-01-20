import { state } from "../app/app-state.js";
import {
  mapSelectionToFaceTextures,
  downscaleImageToMax,
  getMaxTextureSize,
} from "../app/app-utils.js";
import { fetchMintPriceByTokenId, fetchTokenUri } from "../data/chain/cubixles-reader.js";
import { getProvenance } from "../data/nft/indexer";
import { getCollectionFloorSnapshot } from "../data/nft/floor.js";
import { resolveUri, buildImageCandidates } from "../shared/utils/uri";
import { parseIpfsUrl } from "../shared/uri-policy.js";
import { getActiveChainId, getChainOptions, setActiveChainId } from "../config/chains.js";
import { fetchWithGateways } from "../../../../src/shared/ipfs-fetch.js";
import { metadataSchema, extractRefs } from "../../../../src/shared/schemas/metadata.js";

const MIN_FLOOR_ETH = 0.001;
const BASE_MINT_PRICE_ETH = 0.0044;
const PRICE_RATE = 0.07;

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
    <button
      id="token-floor-toggle"
      class="token-floor-toggle"
      type="button"
      aria-expanded="false"
      aria-controls="token-floor-details"
    >
      <span class="token-floor-title">Feingehalt (live)</span>
      <span id="token-feingehalt" class="token-floor-summary">Feingehalt: --</span>
      <span class="token-floor-toggle-icon" aria-hidden="true">▾</span>
    </button>
    <div id="token-floor-details" class="token-floor-details">
      <div class="token-floor-title">Floor snapshot (mint)</div>
      <div id="token-floor-summary" class="token-floor-summary">Snapshot: 0.0000 ETH</div>
      <div id="token-floor-list" class="ui-floor-list"></div>
      <div id="token-feingehalt-note" class="token-floor-note">Fetching live floors…</div>
    </div>
  `;
  document.body.appendChild(panel);
  panel.classList.add("is-collapsed");
  const toggle = panel.querySelector("#token-floor-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      panel.classList.toggle("is-collapsed");
      const expanded = !panel.classList.contains("is-collapsed");
      toggle.setAttribute("aria-expanded", String(expanded));
    });
  }
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
  const candidates = new Set();
  if (nft?.image?.resolved) {
    buildImageCandidates(nft.image).forEach((url) => candidates.add(url));
  }
  const rawMetadata = nft?.sourceMetadata?.raw;
  if (rawMetadata && typeof rawMetadata === "object") {
    appendMetadataImages(rawMetadata, candidates);
  }
  const tokenUri = nft?.tokenUri?.resolved;
  if (!tokenUri) {
    return Array.from(candidates);
  }
  if (tokenUri.startsWith("data:")) {
    const dataMetadata = parseDataJson(tokenUri);
    if (dataMetadata) {
      appendMetadataImages(dataMetadata, candidates);
    }
    return Array.from(candidates);
  }
  try {
    let response;
    const isIpfsGateway = parseIpfsUrl(tokenUri);
    if (tokenUri.startsWith("ipfs://") || isIpfsGateway) {
      ({ response } = await fetchWithGateways(tokenUri));
    } else {
      response = await fetch(tokenUri);
    }
    if (!response?.ok) {
      return candidates;
    }
    const metadata = await response.json();
    const imageCandidates = [metadata?.image, metadata?.image_url, metadata?.imageUrl];
    imageCandidates.forEach((candidate) => {
      if (typeof candidate !== "string" || !candidate.trim()) {
        return;
      }
      buildImageCandidates(candidate).forEach((url) => candidates.add(url));
    });
    if (typeof metadata?.image_data === "string") {
      const svg = metadata.image_data.trim();
      if (!svg) {
        return Array.from(candidates);
      }
      candidates.add(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    }
  } catch (error) {
    return Array.from(candidates);
  }
  return Array.from(candidates);
}

function appendMetadataImages(metadata, candidates) {
  const images = [metadata?.image, metadata?.image_url, metadata?.imageUrl];
  images.forEach((candidate) => {
    if (typeof candidate !== "string" || !candidate.trim()) {
      return;
    }
    buildImageCandidates(candidate).forEach((url) => candidates.add(url));
  });
  if (typeof metadata?.image_data === "string") {
    const svg = metadata.image_data.trim();
    if (!svg) {
      return;
    }
    candidates.add(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  }
}

function parseDataJson(dataUrl) {
  const match = dataUrl.match(/^data:application\/json([^,]*),(.*)$/i);
  if (!match) {
    return null;
  }
  const meta = match[1] || "";
  const payload = match[2] || "";
  try {
    const decoded = meta.includes(";base64")
      ? atob(payload)
      : decodeURIComponent(payload);
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
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
  const mintButton = document.createElement("a");
  mintButton.id = "share-cube";
  mintButton.className = "share-cube-button";
  mintButton.href = "/";
  mintButton.target = "_blank";
  mintButton.rel = "noreferrer";
  mintButton.textContent = "mint yours";
  document.body.appendChild(mintButton);
}

async function resolveTokenChainAndUri(tokenId) {
  const activeChainId = getActiveChainId();
  const chainIds = getChainOptions().map((chain) => chain.id);
  const candidates = [activeChainId, ...chainIds.filter((id) => id !== activeChainId)];
  let lastError;

  for (const chainId of candidates) {
    try {
      const tokenUri = await fetchTokenUri(tokenId, chainId);
      return { chainId, tokenUri };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Unable to resolve token chain.");
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
  initTokenShareDialog();

  let tokenId;
  try {
    tokenId = BigInt(tokenIdRaw);
  } catch (error) {
    setStatus("Invalid tokenId in URL.", "error");
    return true;
  }

  state.currentCubeTokenId = tokenId;
  document.dispatchEvent(new CustomEvent("cube-token-change"));

  let tokenChainId = getActiveChainId();
  let resolvedTokenUri = null;

  try {
    const resolved = await resolveTokenChainAndUri(tokenId);
    tokenChainId = resolved.chainId;
    resolvedTokenUri = resolved.tokenUri;
    setActiveChainId(tokenChainId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to resolve token network.";
    setStatus(message, "error");
    return true;
  }

  try {
    const mintPrice = await fetchMintPriceByTokenId(tokenId, tokenChainId);
    state.tokenMintPriceWei = mintPrice == null ? null : BigInt(mintPrice);
  } catch (error) {
    state.tokenMintPriceWei = null;
  } finally {
    document.dispatchEvent(new CustomEvent("token-mint-price-change"));
  }

  try {
    const tokenUri = resolvedTokenUri ?? (await fetchTokenUri(tokenId, tokenChainId));
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
        : tokenChainId;
    const snapshotEntries = normalizeSnapshotEntries(validation.data, refs);
    renderSnapshotFloor(floorPanel, snapshotEntries, provenanceChainId);

    setStatus("Loading referenced NFTs...");
    const nfts = await Promise.all(
      refs.map((ref) =>
        getProvenance(
          ref.contractAddress,
          String(ref.tokenId),
          provenanceChainId
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
      const liveFloorSum = liveFloors.reduce((total, entry) => {
        const floorValue = typeof entry?.floorEth === "number" ? entry.floorEth : 0;
        return total + (floorValue > 0 ? floorValue : MIN_FLOOR_ETH);
      }, 0);
      const liveFeingehalt = BASE_MINT_PRICE_ETH + liveFloorSum * PRICE_RATE;
      const retrievedAt =
        liveFloors.find((entry) => entry?.retrievedAt)?.retrievedAt ?? null;
      renderFeingehalt(floorPanel, liveFeingehalt, retrievedAt);
    } catch (error) {
      renderFeingehalt(floorPanel, 0, null);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load token.";
    setStatus(message, "error");
  }

  return true;
}
