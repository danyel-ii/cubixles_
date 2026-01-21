import { BrowserProvider, Contract, formatEther } from "ethers";
import { BUILDER_CONTRACT } from "../../config/builder-contracts";
import { formatChainName, getChainConfig, subscribeActiveChain } from "../../config/chains.js";
import { buildBuilderTokenViewUrl } from "../../config/links.js";
import { state } from "../../app/app-state.js";
import { buildBuilderMetadata } from "./builder-metadata.js";
import { pinBuilderAssets, pinTokenMetadata } from "./token-uri-provider.js";
import { subscribeWallet, switchToActiveChain } from "../wallet/wallet.js";
import { resolvePaperclipPalette } from "../paperclip/paperclip-utils.js";
import { fetchWithGateways } from "../../../../../src/shared/ipfs-fetch.js";
import { parseIpfsUrl } from "../../shared/uri-policy.js";
import {
  buildPaperclipSpec,
  DEFAULT_PAPERCLIP_SIZE,
} from "../../shared/paperclip-model.js";

const MIN_FLOOR_WEI = 10_000_000_000_000_000n;

function formatEthFromWei(value) {
  if (!value) {
    return "0.0000";
  }
  try {
    return Number(formatEther(value)).toFixed(6);
  } catch {
    return "0.0000";
  }
}

function formatFloorLabel(floorWei) {
  const resolvedFloor = floorWei && floorWei > 0n ? floorWei : MIN_FLOOR_WEI;
  return formatEthFromWei(resolvedFloor);
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

function resolveTokenUri(nft) {
  const tokenUri = nft?.tokenUri?.original ?? nft?.tokenUri?.resolved ?? "";
  return typeof tokenUri === "string" ? tokenUri.trim() : "";
}

function normalizeTokenUri(tokenUri) {
  if (!tokenUri) {
    return "";
  }
  if (tokenUri.startsWith("ar://")) {
    return `https://arweave.net/${tokenUri.slice("ar://".length)}`;
  }
  return tokenUri;
}

async function fetchNftMetadata(tokenUri) {
  if (!tokenUri) {
    return null;
  }
  if (tokenUri.startsWith("data:")) {
    return parseDataJson(tokenUri);
  }
  const resolvedUri = normalizeTokenUri(tokenUri);
  const isIpfsGateway = parseIpfsUrl(resolvedUri);
  try {
    let response;
    if (resolvedUri.startsWith("ipfs://") || isIpfsGateway) {
      ({ response } = await fetchWithGateways(resolvedUri, { expectsJson: true }));
    } else {
      response = await fetch(resolvedUri);
    }
    if (!response?.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function fetchSelectionMetadata(selection) {
  if (!Array.isArray(selection) || selection.length === 0) {
    return [];
  }
  return Promise.all(
    selection.map(async (nft) => {
      const tokenUri = resolveTokenUri(nft);
      const metadata = await fetchNftMetadata(tokenUri);
      return {
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenId,
        tokenUri: tokenUri || null,
        metadata,
      };
    })
  );
}

export function initBuilderMintUi() {
  const statusEl = document.getElementById("mint-status");
  const mintButton = document.getElementById("mint-submit");
  const amountInput = document.getElementById("mint-payment");
  const mintPriceEl = document.getElementById("mint-price");
  const floorSummaryEl = document.getElementById("mint-floor-summary");
  const floorListEl = document.getElementById("mint-floor-list");
  const errorEl = document.getElementById("builder-error");
  const commitProgressEl = document.getElementById("commit-progress");
  const mintConfirm = document.getElementById("mint-confirm");
  const mintConfirmClose = document.getElementById("mint-confirm-close");
  const mintConfirmContinue = document.getElementById("mint-confirm-continue");
  const mintSuccess = document.getElementById("builder-mint-success");
  const mintSuccessLink = document.getElementById("builder-mint-success-link");
  const mintSuccessForwarder = document.getElementById("builder-mint-success-forwarder-call");
  const mintSuccessClose = document.getElementById("builder-mint-success-close");

  if (!statusEl || !mintButton || !amountInput) {
    return;
  }

  let walletState = null;
  let isMinting = false;
  let quoteInFlight = false;
  let currentQuote = null;

  amountInput.readOnly = true;

  function setStatus(message, tone = "neutral") {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", tone === "error");
    statusEl.classList.toggle("is-success", tone === "success");
  }

  function setCommitProgress(visible) {
    if (!commitProgressEl) {
      return;
    }
    commitProgressEl.classList.toggle("is-visible", visible);
  }

  function setMintSuccessVisible(visible) {
    if (!mintSuccess) {
      return;
    }
    mintSuccess.classList.toggle("is-hidden", !visible);
    if (typeof document !== "undefined") {
      document.body.classList.toggle("mint-confirm-open", visible);
    }
  }

  function setMintConfirmVisible(visible) {
    if (!mintConfirm) {
      return;
    }
    mintConfirm.classList.toggle("is-hidden", !visible);
    if (typeof document !== "undefined") {
      document.body.classList.toggle("mint-confirm-open", visible);
    }
    if (visible && mintConfirmContinue) {
      mintConfirmContinue.focus();
    }
  }

  function buildTxUrl(hash) {
    if (!hash) {
      return "";
    }
    const chain = getChainConfig(BUILDER_CONTRACT.chainId);
    const explorer = chain?.explorer || "";
    return explorer ? `${explorer}/tx/${hash}` : "";
  }

  function triggerConfetti() {
    const root = document.getElementById("confetti-root");
    if (!root) {
      return;
    }
    const burst = document.createElement("div");
    burst.className = "eth-confetti";
    const pieces = 18;
    for (let i = 0; i < pieces; i += 1) {
      const piece = document.createElement("div");
      piece.className = "eth-confetti-piece";
      const angle = Math.random() * Math.PI * 2;
      const distance = 140 + Math.random() * 120;
      const offsetX = Math.cos(angle) * distance;
      const offsetY = 80 + Math.random() * 180;
      const rotation = Math.random() * 360;
      piece.style.setProperty("--confetti-x", `${offsetX.toFixed(1)}px`);
      piece.style.setProperty("--confetti-y", `${offsetY.toFixed(1)}px`);
      piece.style.setProperty("--confetti-rot", `${rotation.toFixed(1)}deg`);
      piece.style.animationDelay = `${(Math.random() * 0.15).toFixed(2)}s`;
      burst.appendChild(piece);
    }
    root.appendChild(burst);
    window.setTimeout(() => {
      burst.remove();
    }, 1600);
  }

  function setError(message) {
    if (!errorEl) {
      return;
    }
    errorEl.textContent = message || "-";
    errorEl.classList.toggle("is-hidden", !message);
  }

  function setDisabled(disabled) {
    mintButton.disabled = disabled;
    amountInput.disabled = disabled;
  }

  function clearFloors() {
    if (floorListEl) {
      floorListEl.innerHTML = "";
    }
    if (floorSummaryEl) {
      floorSummaryEl.textContent = "Total floor (snapshot): 0.0000 ETH";
    }
    if (mintPriceEl) {
      mintPriceEl.textContent = "Mint price: -";
    }
  }

  function renderFloors(selection, floorsWei, totalFloorWei) {
    if (floorSummaryEl) {
      floorSummaryEl.textContent = `Total floor (snapshot): ${formatEthFromWei(
        totalFloorWei
      )} ETH`;
    }
    if (!floorListEl) {
      return;
    }
    floorListEl.innerHTML = "";
    selection.forEach((nft, index) => {
      const row = document.createElement("div");
      row.className = "ui-floor-item";
      const label = nft.collectionName || nft.name || "NFT";
      const tokenId = nft.tokenId || "?";
      const floor = floorsWei[index] ?? 0n;
      row.textContent = `${label} #${tokenId} - ${formatFloorLabel(floor)} ETH`;
      floorListEl.appendChild(row);
    });
  }

  async function fetchQuote(selection) {
    if (quoteInFlight) {
      return null;
    }
    quoteInFlight = true;
    setError("");

    try {
      const response = await fetch("/api/builder/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: BUILDER_CONTRACT.chainId,
          refs: selection.map((nft) => ({
            contractAddress: nft.contractAddress,
            tokenId: nft.tokenId,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error || `Quote failed (${response.status})`;
        setError(message);
        return null;
      }
      if (!data?.signature || !data?.quote) {
        setError("Quote response missing signature.");
        return null;
      }
      const floorsWei = (data.floorsWei || []).map((floor) => BigInt(floor));
      const totalFloorWei = BigInt(data.totalFloorWei || 0);
      const mintPriceWei = BigInt(data.mintPriceWei || 0);
      const quote = {
        totalFloorWei: BigInt(data.quote?.totalFloorWei || 0),
        chainId: BigInt(data.quote?.chainId || BUILDER_CONTRACT.chainId),
        expiresAt: BigInt(data.quote?.expiresAt || 0),
        nonce: BigInt(data.quote?.nonce || 0),
      };
      renderFloors(selection, floorsWei, totalFloorWei);
      amountInput.value = mintPriceWei ? formatEthFromWei(mintPriceWei) : "";
      if (mintPriceEl) {
        mintPriceEl.textContent = mintPriceWei
          ? `Mint price: ${formatEthFromWei(mintPriceWei)} ETH`
          : "Mint price: -";
      }
      return {
        refs: selection.map((nft) => ({
          contractAddress: nft.contractAddress,
          tokenId: BigInt(nft.tokenId),
        })),
        floorsWei,
        quote,
        signature: data.signature,
        totalFloorWei,
        mintPriceWei,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quote failed.";
      setError(message);
      return null;
    } finally {
      quoteInFlight = false;
    }
  }

  async function refreshQuote() {
    if (!walletState || walletState.status !== "connected") {
      setStatus("Connect your wallet to mint.");
      setDisabled(true);
      clearFloors();
      setError("");
      currentQuote = null;
      return;
    }
    if (BUILDER_CONTRACT.address === "0x0000000000000000000000000000000000000000") {
      setStatus("Builder minter not deployed on this chain.", "error");
      setDisabled(true);
      clearFloors();
      setError("Missing builder deployment.");
      currentQuote = null;
      return;
    }
    const selection = state.nftSelection || [];
    if (selection.length < 1 || selection.length > 6) {
      setStatus("Select 1 to 6 NFTs to continue.");
      setDisabled(true);
      clearFloors();
      currentQuote = null;
      return;
    }
    setStatus("Fetching builder quote...");
    setDisabled(true);
    const quote = await fetchQuote(selection);
    if (!quote) {
      setStatus("Quote failed. Try again.", "error");
      setDisabled(true);
      currentQuote = null;
      return;
    }
    currentQuote = quote;
    setStatus("Builder quote ready.", "success");
    setDisabled(false);
  }

  async function handleMint() {
    if (isMinting) {
      return;
    }
    if (!walletState || walletState.status !== "connected") {
      setStatus("Connect your wallet to mint.", "error");
      return;
    }
    if (!currentQuote) {
      setStatus("Quote missing. Refresh and try again.", "error");
      await refreshQuote();
      return;
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (currentQuote.quote.expiresAt <= now) {
      setStatus("Quote expired. Refreshing...", "error");
      await refreshQuote();
      return;
    }

    isMinting = true;
    setDisabled(true);
    setCommitProgress(true);
    setStatus("Preparing builder mint...");
    setError("");

    try {
      const selection = state.nftSelection || [];
      if (selection.length < 1 || selection.length > 6) {
        throw new Error("Select 1 to 6 NFTs before minting.");
      }
      const selectionMetadataPromise = fetchSelectionMetadata(selection);
      const provider = new BrowserProvider(walletState.provider);
      const network = await provider.getNetwork();
      const walletChainId = Number(network.chainId);
      if (walletChainId !== BUILDER_CONTRACT.chainId) {
        setStatus(
          `Approve network switch to ${formatChainName(
            BUILDER_CONTRACT.chainId
          )} in your wallet.`,
          "error"
        );
        const switched = await switchToActiveChain();
        if (!switched) {
          throw new Error("Network switch rejected.");
        }
      }
      const signer = await provider.getSigner();
      const contract = new Contract(
        BUILDER_CONTRACT.address,
        BUILDER_CONTRACT.abi,
        signer
      );
      const totalFloorWei = currentQuote.totalFloorWei ?? 0n;
      const floorsWei = currentQuote.floorsWei ?? [];
      const mintPriceWei = currentQuote.mintPriceWei ?? 0n;
      const expectedTokenId = typeof contract.nextTokenId === "function"
        ? await contract.nextTokenId()
        : (await contract.totalMinted()) + 1n;
      const tokenId = expectedTokenId.toString();
      const externalUrl = buildBuilderTokenViewUrl(tokenId);
      const paperclipPalette = resolvePaperclipPalette();
      const paperclipSeed = walletState.address?.toLowerCase() || "";
      const paperclipSpec = buildPaperclipSpec({
        seed: paperclipSeed,
        palette: paperclipPalette,
        size: DEFAULT_PAPERCLIP_SIZE,
      });
      const paperclipQrText = externalUrl;
      setStatus("Pinning builder assets...");
      const assetResult = await pinBuilderAssets({
        viewerUrl: externalUrl,
        tokenId,
        signer,
        address: walletState.address,
        chainId: BUILDER_CONTRACT.chainId,
        paperclip: {
          seed: paperclipSeed,
          palette: paperclipPalette,
          size: DEFAULT_PAPERCLIP_SIZE,
          qrText: paperclipQrText,
        },
      });
      const qrUrl = assetResult.qrUrl || "";
      const cardUrl = assetResult.cardUrl || "";
      const paperclipUrl = assetResult.paperclipUrl || "";
      const imageUrl = paperclipUrl;
      const animationUrl = cardUrl || externalUrl;
      const floorsWeiStrings = floorsWei.map((floor) => floor.toString());
      const floorsEth = floorsWei.map((floor) => formatEthFromWei(floor));
      setStatus("Collecting linked NFT metadata...");
      const selectedNftMetadata = await selectionMetadataPromise;
      const metadataPayload = buildBuilderMetadata({
        tokenId,
        minter: walletState.address,
        chainId: BUILDER_CONTRACT.chainId,
        selection,
        floorsWei: floorsWeiStrings,
        floorsEth,
        totalFloorWei: totalFloorWei.toString(),
        totalFloorEth: formatEthFromWei(totalFloorWei),
        mintPriceWei: mintPriceWei.toString(),
        mintPriceEth: formatEthFromWei(mintPriceWei),
        imageUrl,
        animationUrl,
        externalUrl,
        qrImage: qrUrl,
        paperclipImage: paperclipUrl,
        paperclipSpec,
        paperclipQrText,
        selectedNftMetadata,
      });

      setStatus("Pinning builder metadata...");
      const { tokenURI, metadataHash } = await pinTokenMetadata({
        metadata: metadataPayload,
        signer,
        address: walletState.address,
        chainId: BUILDER_CONTRACT.chainId,
      });

      setStatus("Submitting builder mint...");
      const tx = await contract.mintBuildersWithMetadata(
        currentQuote.refs,
        floorsWei,
        currentQuote.quote,
        currentQuote.signature,
        tokenURI,
        metadataHash,
        expectedTokenId,
        { value: mintPriceWei }
      );
      setStatus("Builder mint submitted.");
      await tx.wait();
      setStatus("Builder mint confirmed.", "success");
      const txUrl = buildTxUrl(tx.hash);
      if (mintSuccessLink) {
        mintSuccessLink.href = txUrl || "#";
        mintSuccessLink.style.display = txUrl ? "" : "none";
      }
      if (mintSuccessForwarder) {
        mintSuccessForwarder.textContent = `royaltyForwarderByTokenId(${tokenId})`;
      }
      setMintSuccessVisible(true);
      triggerConfetti();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mint failed.";
      setError(message);
      setStatus(message, "error");
    } finally {
      isMinting = false;
      setDisabled(false);
      setCommitProgress(false);
    }
  }

  function showMintConfirm() {
    if (!mintConfirm) {
      return false;
    }
    setMintConfirmVisible(true);
    return true;
  }

  if (mintConfirmClose) {
    mintConfirmClose.addEventListener("click", () => setMintConfirmVisible(false));
  }
  if (mintConfirm) {
    mintConfirm.addEventListener("click", (event) => {
      if (event.target === mintConfirm) {
        setMintConfirmVisible(false);
      }
    });
  }
  if (mintSuccessClose) {
    mintSuccessClose.addEventListener("click", () => setMintSuccessVisible(false));
  }
  if (mintSuccess) {
    mintSuccess.addEventListener("click", (event) => {
      if (event.target === mintSuccess) {
        setMintSuccessVisible(false);
      }
    });
  }
  if (mintConfirmContinue) {
    mintConfirmContinue.addEventListener("click", () => {
      setMintConfirmVisible(false);
      void handleMint();
    });
  }

  mintButton.addEventListener("click", () => {
    if (showMintConfirm()) {
      return;
    }
    void handleMint();
  });

  subscribeWallet((next) => {
    walletState = next;
    void refreshQuote();
  });

  subscribeActiveChain(() => {
    void refreshQuote();
  });

  document.addEventListener("nft-selection-change", () => {
    void refreshQuote();
  });

  setStatus("Connect your wallet to mint.");
  setDisabled(true);
  clearFloors();
}
