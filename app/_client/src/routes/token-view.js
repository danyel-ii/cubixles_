import { state } from "../app/app-state.js";
import {
  mapSelectionToFaceTextures,
  downscaleImageToMax,
  getMaxTextureSize,
} from "../app/app-utils.js";
import { fetchTokenUri } from "../data/chain/icecube-reader.js";
import { getProvenance } from "../data/nft/indexer";
import { resolveUri } from "../shared/utils/uri";
import { ICECUBE_CONTRACT } from "../config/contracts";

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

function resolveRefs(metadata) {
  const provenance = metadata?.provenance ?? null;
  if (provenance?.refsFaces && Array.isArray(provenance.refsFaces)) {
    return provenance.refsFaces;
  }
  if (provenance?.refs && Array.isArray(provenance.refs)) {
    return provenance.refs;
  }
  if (provenance?.nfts && Array.isArray(provenance.nfts)) {
    return provenance.nfts.map((nft) => ({
      contractAddress: nft.contractAddress,
      tokenId: nft.tokenId,
    }));
  }
  return [];
}

async function loadImages(urls) {
  if (typeof loadImage !== "function") {
    throw new Error("Image loader unavailable.");
  }
  const maxSize = getMaxTextureSize();
  const loaders = urls.map(
    (url) =>
      new Promise((resolve) => {
        loadImage(
          url,
          (img) => resolve(downscaleImageToMax(img, maxSize)),
          () => resolve(null)
        );
      })
  );
  return Promise.all(loaders);
}

async function waitForFrostedTexture() {
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

  let tokenId;
  try {
    tokenId = BigInt(tokenIdRaw);
  } catch (error) {
    setStatus("Invalid tokenId in URL.", "error");
    return true;
  }

  state.currentCubeTokenId = tokenId;
  document.dispatchEvent(new CustomEvent("cube-token-change"));

  try {
    const tokenUri = await fetchTokenUri(tokenId);
    const resolved = resolveUri(tokenUri);
    if (!resolved?.resolved) {
      throw new Error("Token URI could not be resolved.");
    }
    const response = await fetch(resolved.resolved);
    if (!response.ok) {
      throw new Error(`Metadata fetch failed (${response.status}).`);
    }
    const metadata = await response.json();
    const refs = resolveRefs(metadata);
    if (!refs.length) {
      throw new Error("No provenance refs found in metadata.");
    }

    setStatus("Loading referenced NFTs...");
    const nfts = await Promise.all(
      refs.map((ref) =>
        getProvenance(
          ref.contractAddress,
          String(ref.tokenId),
          ICECUBE_CONTRACT.chainId
        )
      )
    );
    const urls = nfts.map((nft) => nft.image?.resolved ?? null);
    if (urls.some((url) => !url)) {
      throw new Error("One or more referenced NFTs are missing images.");
    }
    const images = await loadImages(urls);
    const usable = images.filter((img) => img);
    if (usable.length !== images.length) {
      throw new Error("Failed to load one or more NFT images.");
    }

    await waitForFrostedTexture();
    state.faceTextures = mapSelectionToFaceTextures(usable, state.frostedTexture);
    state.nftSelection = nfts;
    setStatus("Loaded.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load token.";
    setStatus(message, "error");
  }

  return true;
}
