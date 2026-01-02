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
  if (typeof window !== "undefined" && window.__CUBELESS_SKIP_FROSTED__) {
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
        <a id="share-farcaster" class="share-button" target="_blank" rel="noreferrer">Farcaster</a>
        <a id="share-x" class="share-button" target="_blank" rel="noreferrer">X</a>
        <a id="share-base" class="share-button" target="_blank" rel="noreferrer">Base</a>
        <a id="share-signal" class="share-button" target="_blank" rel="noreferrer">Signal</a>
        <button id="share-copy" class="share-button is-ghost" type="button">Copy link</button>
      </div>
      <button id="share-close" class="share-close" type="button">Close</button>
    </div>
  `;
  document.body.appendChild(modal);

  const backdrop = modal.querySelector("#share-backdrop");
  const closeButton = modal.querySelector("#share-close");
  const copyButton = modal.querySelector("#share-copy");
  const farcasterLink = modal.querySelector("#share-farcaster");
  const xLink = modal.querySelector("#share-x");
  const baseLink = modal.querySelector("#share-base");
  const signalLink = modal.querySelector("#share-signal");

  let currentUrl = "";

  function closeModal() {
    modal.classList.add("is-hidden");
  }

  async function copyLink() {
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
    const text = encodeURIComponent("Check out this cubixles_ cube");
    farcasterLink.href = `https://warpcast.com/~/compose?text=${text}&embeds[]=${encoded}`;
    xLink.href = `https://twitter.com/intent/tweet?text=${text}&url=${encoded}`;
    baseLink.href = `https://www.base.app/?link=${encoded}`;
    signalLink.href = `signal://send?text=${text}%20${encoded}`;
    modal.classList.remove("is-hidden");
  }

  backdrop?.addEventListener("click", closeModal);
  closeButton?.addEventListener("click", closeModal);
  copyButton?.addEventListener("click", copyLink);

  const shareButton = document.createElement("button");
  shareButton.id = "share-cube";
  shareButton.className = "share-cube-button";
  shareButton.type = "button";
  shareButton.textContent = "share cube";
  document.body.appendChild(shareButton);

  shareButton.addEventListener("click", () => {
    if (!currentUrl) {
      return;
    }
    openModal(currentUrl);
  });

  function openShare(url) {
    if (!url) {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  farcasterLink?.addEventListener("click", (event) => {
    event.preventDefault();
    openShare(farcasterLink.href);
  });
  xLink?.addEventListener("click", (event) => {
    event.preventDefault();
    openShare(xLink.href);
  });
  baseLink?.addEventListener("click", (event) => {
    event.preventDefault();
    openShare(baseLink.href);
  });
  signalLink?.addEventListener("click", (event) => {
    event.preventDefault();
    openShare(signalLink.href);
  });

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

  try {
    const tokenUri = await fetchTokenUri(tokenId);
    if (typeof setShareUrl === "function") {
      setShareUrl(`${window.location.origin}/m/${tokenId.toString()}`);
    }
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
