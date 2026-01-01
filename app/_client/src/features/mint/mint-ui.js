import { BrowserProvider, Contract } from "ethers";
import { ICECUBE_CONTRACT } from "../../config/contracts";
import { buildPalettePreviewGifUrl, buildTokenViewUrl } from "../../config/links.js";
import { buildProvenanceBundle } from "../../data/nft/indexer";
import { getCollectionFloorSnapshot } from "../../data/nft/floor.js";
import { subscribeWallet } from "../wallet/wallet.js";
import { state } from "../../app/app-state.js";
import { buildMintMetadata } from "./mint-metadata.js";
import {
  buildPaletteImageUrl,
  computePaletteCommitSeed,
  loadPaletteManifest,
  pickPaletteEntry,
} from "../../data/palette/manifest.js";
import { pinTokenMetadata } from "./token-uri-provider.js";
import { computeRefsHash, sortRefsCanonically } from "./refs.js";
import {
  computeGifSeed,
  computeVariantIndex,
  decodeVariantIndex,
  gifIpfsUrl,
} from "../../gif/variant.js";
import { fetchLessTotalSupply } from "../../data/chain/less-supply.js";

const FALLBACK_BASE_PRICE_WEI = 1_500_000_000_000_000n;
const ONE_BILLION = 1_000_000_000n;
const WAD = 1_000_000_000_000_000_000n;
const PRICE_STEP_WEI = 100_000_000_000_000n;
const IS_DEV =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Mint failed.";
}

function isZeroAddress(address) {
  return !address || address === "0x0000000000000000000000000000000000000000";
}

function formatChainName(chainId) {
  if (chainId === 1) {
    return "Ethereum Mainnet";
  }
  if (chainId === 11155111) {
    return "Sepolia";
  }
  return `Chain ${chainId}`;
}

function generateSalt() {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("Secure random unavailable.");
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function initMintUi() {
  const statusEl = document.getElementById("mint-status");
  const mintButton = document.getElementById("mint-submit");
  const amountInput = document.getElementById("mint-payment");
  const mintPriceEl = document.getElementById("mint-price");
  const floorSummaryEl = document.getElementById("mint-floor-summary");
  const floorListEl = document.getElementById("mint-floor-list");

  if (!statusEl || !mintButton || !amountInput) {
    return;
  }

  let walletState = null;
  const devChecklist = IS_DEV ? initDevChecklist(statusEl.parentElement) : null;
  const floorCache = new Map();
  let currentMintPriceWei = null;

  amountInput.readOnly = true;

  function setStatus(message, tone = "neutral") {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", tone === "error");
    statusEl.classList.toggle("is-success", tone === "success");
  }

  function getToastRoot() {
    let root = document.getElementById("toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "toast-root";
      root.className = "toast-root";
      document.body.appendChild(root);
    }
    return root;
  }

  function buildTxUrl(hash) {
    if (!hash) {
      return "";
    }
    const chainId = ICECUBE_CONTRACT.chainId;
    const base =
      chainId === 1
        ? "https://etherscan.io"
        : chainId === 11155111
        ? "https://sepolia.etherscan.io"
        : "";
    return base ? `${base}/tx/${hash}` : "";
  }

  function showToast({ title, message, tone = "neutral", links = [] }) {
    const root = getToastRoot();
    const toast = document.createElement("div");
    toast.className = `toast toast-${tone}`;

    const heading = document.createElement("div");
    heading.className = "toast-title";
    heading.textContent = title;
    toast.appendChild(heading);

    if (message) {
      const body = document.createElement("div");
      body.className = "toast-body";
      body.textContent = message;
      toast.appendChild(body);
    }

    if (links.length) {
      const actions = document.createElement("div");
      actions.className = "toast-actions";
      links.forEach(({ label, href }) => {
        if (!href) {
          return;
        }
        const link = document.createElement("a");
        link.className = "toast-link";
        link.href = href;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = label;
        actions.appendChild(link);
      });
      toast.appendChild(actions);
    }

    root.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    const remove = () => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 200);
    };
    setTimeout(remove, 7000);
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

  function formatEthFromWei(wei) {
    if (!wei) {
      return "0.0000";
    }
    const value = Number(wei) / 1e18;
    if (Number.isNaN(value)) {
      return "0.0000";
    }
    return value.toFixed(6);
  }

  async function fetchMintPriceFromContract() {
    if (!walletState || walletState.status !== "connected") {
      return null;
    }
    if (isZeroAddress(ICECUBE_CONTRACT.address) || !ICECUBE_CONTRACT.abi?.length) {
      return null;
    }
    try {
      const provider = new BrowserProvider(walletState.provider);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== ICECUBE_CONTRACT.chainId) {
        return null;
      }
      const contract = new Contract(
        ICECUBE_CONTRACT.address,
        ICECUBE_CONTRACT.abi,
        provider
      );
      const price = await contract.currentMintPrice();
      return price;
    } catch (error) {
      return null;
    }
  }

  function computeMintPriceFromSupply() {
    if (state.lessTotalSupply === null || state.lessTotalSupply === undefined) {
      return null;
    }
    const supply = BigInt(state.lessTotalSupply);
    const oneBillionWad = ONE_BILLION * WAD;
    const clamped = supply > oneBillionWad ? oneBillionWad : supply;
    const delta = oneBillionWad - clamped;
    const factorWad = WAD + (delta * WAD) / oneBillionWad;
    const rawPrice = (FALLBACK_BASE_PRICE_WEI * factorWad) / WAD;
    return roundUp(rawPrice, PRICE_STEP_WEI);
  }

  function roundUp(value, step) {
    if (value === 0n) {
      return 0n;
    }
    return ((value + step - 1n) / step) * step;
  }

  async function refreshMintPrice() {
    const onchain = await fetchMintPriceFromContract();
    if (onchain) {
      currentMintPriceWei = BigInt(onchain);
    } else {
      const computed = computeMintPriceFromSupply();
      currentMintPriceWei = computed;
    }
    state.mintPriceWei = currentMintPriceWei;
    if (mintPriceEl) {
      mintPriceEl.textContent = currentMintPriceWei
        ? `Mint price: ${formatEthFromWei(currentMintPriceWei)} ETH.`
        : "Mint price: —";
    }
    if (amountInput && currentMintPriceWei) {
      amountInput.value = formatEthFromWei(currentMintPriceWei);
    }
  }

  async function refreshFloorSnapshot(capture = false) {
    if (!floorSummaryEl || !floorListEl) {
      return;
    }
    const selection = state.nftSelection;
    if (!selection.length) {
      floorSummaryEl.textContent = "Total floor (snapshot): 0.0000 ETH";
      floorListEl.textContent = "Select NFTs to view floor snapshot.";
      state.sumFloorEth = 0;
      if (capture) {
        state.floorSnapshotAt = new Date().toISOString();
      }
      document.dispatchEvent(new CustomEvent("floor-snapshot-change"));
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
    state.sumFloorEth = sumFloor;
    if (capture) {
      state.floorSnapshotAt = new Date().toISOString();
    }
    document.dispatchEvent(new CustomEvent("floor-snapshot-change"));
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
    setStatus("Ready to mint.");
    setDisabled(false);
  }

  function extractMintedTokenId(receipt, contract) {
    if (!receipt?.logs || !contract) {
      return null;
    }
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === "Minted") {
          return parsed.args?.tokenId ?? null;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  subscribeWallet((next) => {
    walletState = next;
    updateEligibility();
    refreshMintPrice();
  });

  document.addEventListener("nft-selection-change", () => {
    updateEligibility();
    refreshFloorSnapshot();
  });
  document.addEventListener("less-supply-change", () => {
    refreshMintPrice();
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
    setStatus("Preparing mint steps...");
    try {
      await refreshFloorSnapshot(true);
      const provider = new BrowserProvider(walletState.provider);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== ICECUBE_CONTRACT.chainId) {
        throw new Error(
          `Switch wallet to ${formatChainName(ICECUBE_CONTRACT.chainId)}.`
        );
      }
      if (!currentMintPriceWei) {
        throw new Error("Mint price unavailable. Try again shortly.");
      }
      const signer = await provider.getSigner();
      const contract = new Contract(
        ICECUBE_CONTRACT.address,
        ICECUBE_CONTRACT.abi,
        signer
      );
      const salt = generateSalt();
      const bundle = await buildProvenanceBundle(
        state.nftSelection,
        walletState.address,
        ICECUBE_CONTRACT.chainId
      );
      const refsFaces = state.nftSelection.map((nft) => ({
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenId,
      }));
      const refsForContract = state.nftSelection.map((nft) => ({
        contractAddress: nft.contractAddress,
        tokenId: BigInt(nft.tokenId),
      }));
      const refsCanonical = sortRefsCanonically(refsForContract);
      const refsHash = computeRefsHash(refsCanonical);
      const refsCanonicalMeta = refsCanonical.map((ref) => ({
        contractAddress: ref.contractAddress,
        tokenId: ref.tokenId.toString(),
      }));
      const previewTokenId = await contract.previewTokenId(salt, refsCanonical);
      const lessSupplyMint = await fetchLessTotalSupply(ICECUBE_CONTRACT.chainId);
      const tokenId = BigInt(previewTokenId);
      const selectionSeed = computeGifSeed({
        tokenId,
        minter: walletState.address,
      });
      showToast({
        title: "Two-step mint",
        message: "You will confirm two wallet prompts: commit, then mint.",
        tone: "neutral",
      });
      setStatus("Step 1/2: confirm commit in your wallet.");
      const commitTx = await contract.commitMint(salt, refsHash);
      showToast({
        title: "Commit submitted",
        message: `Commit broadcast to ${formatChainName(ICECUBE_CONTRACT.chainId)}.`,
        tone: "neutral",
        links: [{ label: "View tx", href: buildTxUrl(commitTx.hash) }],
      });
      setStatus("Waiting for commit confirmation...");
      const commitReceipt = await commitTx.wait();
      const commitBlockNumber = commitReceipt?.blockNumber;
      if (!commitBlockNumber) {
        throw new Error("Commit block unavailable.");
      }
      const commitBlock = await provider.getBlock(commitBlockNumber);
      const commitBlockHash = commitBlock?.hash;
      if (!commitBlockHash) {
        throw new Error("Commit hash unavailable.");
      }
      const paletteSeed = computePaletteCommitSeed({
        refsHash,
        salt,
        minter: walletState.address,
        commitBlockNumber,
        commitBlockHash,
      });
      const paletteManifest = await loadPaletteManifest();
      const { entry: paletteEntry, index: paletteIndex } = pickPaletteEntry(
        paletteSeed,
        paletteManifest
      );
      const variantIndex = computeVariantIndex(selectionSeed);
      const params = decodeVariantIndex(variantIndex);
      const paletteImageUrl = buildPaletteImageUrl(paletteEntry);
      const imageUrl = buildPalettePreviewGifUrl();
      const animationUrl = buildTokenViewUrl(tokenId.toString());
      if (!animationUrl) {
        throw new Error("Token viewer URL is not configured.");
      }
      const metadata = buildMintMetadata({
        tokenId: tokenId.toString(),
        minter: walletState.address,
        chainId: ICECUBE_CONTRACT.chainId,
        selection: state.nftSelection,
        provenanceBundle: bundle,
        refsFaces,
        refsCanonical: refsCanonicalMeta,
        salt,
        animationUrl,
        imageUrl,
        paletteEntry,
        paletteIndex,
        paletteImageUrl,
        lessSupplyMint: lessSupplyMint.toString(),
      });
      setStatus("Pinning metadata...");
      const tokenUri = await pinTokenMetadata({
        metadata,
        signer,
        address: walletState.address,
      });
      if (devChecklist) {
        const diagnostics = buildDiagnostics({
          selection: state.nftSelection,
          metadata,
          tokenUri,
          amountInput: amountInput.value,
          walletAddress: walletState.address,
          mintPriceWei: currentMintPriceWei,
          tokenId: tokenId.toString(),
        });
        logDiagnostics(diagnostics, devChecklist);
      }
      state.currentCubeTokenId = tokenId;
      document.dispatchEvent(new CustomEvent("cube-token-change"));
      const overrides = { value: currentMintPriceWei };

      setStatus("Step 2/2: confirm mint in your wallet.");
      const tx = await contract.mint(salt, tokenUri, refsCanonical, overrides);
      showToast({
        title: "Mint submitted",
        message: `Transaction broadcast to ${formatChainName(ICECUBE_CONTRACT.chainId)}.`,
        tone: "neutral",
        links: [{ label: "View tx", href: buildTxUrl(tx.hash) }],
      });
      setStatus("Waiting for confirmation...");
      const receipt = await tx.wait();
      const mintedTokenId = extractMintedTokenId(receipt, contract);
      if (mintedTokenId !== null && mintedTokenId !== undefined) {
        state.currentCubeTokenId = BigInt(mintedTokenId);
        document.dispatchEvent(new CustomEvent("cube-token-change"));
      }
      setStatus("Mint confirmed.", "success");
      const tokenUrl = mintedTokenId ? buildTokenViewUrl(mintedTokenId.toString()) : "";
      showToast({
        title: "Mint confirmed",
        message: mintedTokenId ? `Token #${mintedTokenId.toString()}` : "Transaction confirmed.",
        tone: "success",
        links: [
          { label: "View tx", href: buildTxUrl(tx.hash) },
          { label: "View token", href: tokenUrl },
        ],
      });
      document.dispatchEvent(new CustomEvent("mint-complete"));
    } catch (error) {
      const message = formatError(error);
      setStatus(message, "error");
      showToast({
        title: "Mint failed",
        message,
        tone: "error",
      });
    } finally {
      setDisabled(false);
      updateEligibility();
    }
  });

  refreshMintPrice();

  updateEligibility();
  refreshFloorSnapshot();
}

function buildDiagnostics({
  selection,
  metadata,
  tokenUri,
  amountInput,
  walletAddress,
  mintPriceWei,
  tokenId,
}) {
  const sumFloorEth = selection.reduce((total, nft) => {
    if (typeof nft.collectionFloorEth !== "number" || Number.isNaN(nft.collectionFloorEth)) {
      return total;
    }
    return total + nft.collectionFloorEth;
  }, 0);

  return {
    walletAddress,
    tokenId,
    selectionCount: selection.length,
    economics: {
      mintPriceEth: mintPriceWei
        ? Number(mintPriceWei) / 1e18
        : null,
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
