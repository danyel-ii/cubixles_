import {
  BrowserProvider,
  Contract,
  Interface,
  JsonRpcProvider,
  solidityPackedKeccak256,
} from "ethers";
import { CUBIXLES_CONTRACT } from "../../config/contracts";
import {
  formatChainName,
  getChainConfig,
  isSupportedChainId,
  subscribeActiveChain,
} from "../../config/chains.js";
import { buildTokenViewUrl, getAnimationUrl } from "../../config/links.js";
import { getCollectionFloorSnapshot } from "../../data/nft/floor.js";
import {
  buildPaletteImagePath,
  buildPaletteImageUrl,
  getPaletteEntryByIndex,
  loadPaletteManifest,
} from "../../data/palette/manifest.js";
import { subscribeWallet, switchToActiveChain } from "../wallet/wallet.js";
import { state } from "../../app/app-state.js";
import { buildMintMetadata } from "./mint-metadata.js";
import { computeRefsHash, sortRefsCanonically } from "./refs.js";
import { pinTokenMetadata } from "./token-uri-provider.js";

const FALLBACK_BASE_PRICE_WEI = 2_200_000_000_000_000n;
const ONE_BILLION = 1_000_000_000n;
const WAD = 1_000_000_000_000_000_000n;
const PRICE_STEP_WEI = 100_000_000_000_000n;
const COMMIT_REVEAL_DELAY_BLOCKS = 1n;
const COMMIT_REVEAL_WINDOW_BLOCKS = 256n;
const IS_DEV =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
const CUBIXLES_INTERFACE =
  CUBIXLES_CONTRACT?.abi?.length ? new Interface(CUBIXLES_CONTRACT.abi) : null;

const CUSTOM_ERROR_MESSAGES = {
  InsufficientEth: "Insufficient ETH for mint price.",
  MintCommitRequired: "Commit required before minting. Please retry.",
  MintCommitExpired: "Commit expired. Please retry to create a new commit.",
  MintCommitPendingBlock: "Commit pending. Wait for the reveal window to open.",
  MintCommitMismatch: "Mint selection changed since commit. Please re-commit.",
  MintCommitCooldown: "Commit cooldown active. Please wait before retrying.",
  MintCommitEmpty: "Commit missing. Please retry.",
  MintCommitActive:
    "Existing commit still active. Use the same selection or wait for it to expire.",
  MintMetadataCommitRequired: "Metadata commit required before minting.",
  MintMetadataCommitActive: "Metadata already committed for this mint.",
  MintMetadataMismatch: "Metadata mismatch. Please retry.",
  MetadataHashRequired: "Metadata hash missing. Please retry.",
  ImagePathHashRequired: "Image path hash missing. Please retry.",
  InvalidReferenceCount: "Select 1 to 6 NFTs.",
  RefNotOwned: "You do not own one of the selected NFTs.",
  RefOwnershipCheckFailed:
    "Failed to verify ownership for a selected NFT. Try again.",
  MintCapReached: "Mint cap reached.",
  TokenIdExists: "Token already exists. Please retry.",
  FixedPriceRequired: "Mint pricing misconfigured. Please contact support.",
  FixedPriceNotAllowed: "Mint pricing mode is disabled.",
  LinearPricingConfigRequired: "Mint pricing misconfigured. Please contact support.",
  LinearPricingNotAllowed: "Mint pricing mode is disabled.",
  LessTokenRequired: "LESS token is required for this contract.",
  ResaleSplitterRequired: "Royalty receiver misconfigured.",
  RoyaltyReceiverRequired: "Royalty receiver required.",
  RoyaltyTooHigh: "Royalty rate too high.",
  AddressInsufficientBalance: "Contract balance is insufficient to transfer ETH.",
  FailedInnerCall: "Payment transfer failed. Try again.",
};

function isDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1") {
    return true;
  }
  try {
    return window.localStorage.getItem("cubixles_debug") === "1";
  } catch (error) {
    return false;
  }
}

function extractRevertData(error) {
  const candidates = [
    error?.data,
    error?.error?.data,
    error?.error?.data?.data,
    error?.info?.error?.data,
    error?.info?.error?.data?.data,
    error?.data?.data,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.startsWith("0x")) {
      return candidate;
    }
  }
  return null;
}

function parseCustomErrorName(error, iface) {
  if (!iface) {
    return null;
  }
  const data = extractRevertData(error);
  if (data) {
    try {
      const parsed = iface.parseError(data);
      return parsed?.name || null;
    } catch (parseError) {
      void parseError;
    }
  }
  const message =
    error?.shortMessage || error?.reason || error?.message || "";
  const match = message.match(/execution reverted: ([A-Za-z0-9_]+)\b/);
  return match ? match[1] : null;
}

function formatError(error, { iface } = {}) {
  if (!error) {
    return "Mint failed.";
  }
  const code = error?.code ?? error?.error?.code ?? error?.info?.error?.code;
  const shortMessage = error?.shortMessage || "";
  const message = error?.message || shortMessage || "Mint failed.";

  if (code === 4001 || code === "ACTION_REJECTED") {
    return "Transaction cancelled in wallet.";
  }
  if (
    code === "INSUFFICIENT_FUNDS" ||
    code === -32000 ||
    /insufficient funds/i.test(message)
  ) {
    return "Insufficient ETH to cover gas (and mint price, if applicable).";
  }
  if (/user rejected|denied|cancelled/i.test(message)) {
    return "Transaction cancelled in wallet.";
  }

  const customName = parseCustomErrorName(error, iface);
  if (customName && CUSTOM_ERROR_MESSAGES[customName]) {
    return CUSTOM_ERROR_MESSAGES[customName];
  }

  if (code === "CALL_EXCEPTION" || /missing revert data/i.test(message)) {
    return "Transaction reverted. Check your wallet network and try again.";
  }
  if (code === "NETWORK_ERROR") {
    return "Network error. Check your wallet connection and retry.";
  }

  return message || "Mint failed.";
}

function isZeroAddress(address) {
  return !address || address === "0x0000000000000000000000000000000000000000";
}

function generateSalt() {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("Secure random unavailable.");
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function computeCommitmentHash({ minter, salt, refsHash }) {
  if (!minter || !salt || !refsHash) {
    return null;
  }
  return solidityPackedKeccak256(
    ["string", "address", "bytes32", "bytes32"],
    ["cubixles_:commit:v1", minter, salt, refsHash]
  );
}

function normalizeBytes32(value, label) {
  if (!value || typeof value !== "string") {
    throw new Error(`${label} unavailable.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} unavailable.`);
  }
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`${label} must be 32 bytes.`);
  }
  return normalized;
}

function toTokenIdString(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number") {
    return Math.trunc(value).toString();
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}

function normalizeRefsForMetadata(refs) {
  return refs.map((ref) => ({
    contractAddress: ref.contractAddress,
    tokenId: toTokenIdString(ref.tokenId),
  }));
}

function buildProvenanceBundle(selection, minter, chainId) {
  return {
    chainId,
    selectedBy: minter,
    retrievedAt: new Date().toISOString(),
    nfts: selection.map((nft) => ({
      chainId: nft.chainId,
      contractAddress: nft.contractAddress,
      tokenId: toTokenIdString(nft.tokenId),
      tokenUri: nft.tokenUri ?? null,
      image: nft.image ?? null,
      sourceMetadata: { raw: null },
      retrievedVia: "alchemy",
      retrievedAt: new Date().toISOString(),
      collectionFloorEth:
        typeof nft.collectionFloorEth === "number" ? nft.collectionFloorEth : 0,
      collectionFloorRetrievedAt: nft.collectionFloorRetrievedAt ?? null,
    })),
  };
}

function buildCommitStorageKey(chainId, address) {
  if (!address) {
    return null;
  }
  return `cubixles:commit:${chainId}:${address.toLowerCase()}`;
}

function loadStoredCommit(chainId, address) {
  try {
    const key = buildCommitStorageKey(chainId, address);
    if (!key || !window?.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.salt || !parsed?.commitment || !parsed?.refsHash) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveStoredCommit(chainId, address, payload) {
  try {
    const key = buildCommitStorageKey(chainId, address);
    if (!key || !window?.localStorage) {
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    void error;
  }
}

function clearStoredCommit(chainId, address) {
  try {
    const key = buildCommitStorageKey(chainId, address);
    if (!key || !window?.localStorage) {
      return;
    }
    window.localStorage.removeItem(key);
  } catch (error) {
    void error;
  }
}

export function initMintUi() {
  const statusEl = document.getElementById("mint-status");
  const mintButton = document.getElementById("mint-submit");
  const amountInput = document.getElementById("mint-payment");
  const mintPriceEl = document.getElementById("mint-price");
  const mintPriceNoteEl = document.getElementById("mint-price-note");
  const floorSummaryEl = document.getElementById("mint-floor-summary");
  const floorListEl = document.getElementById("mint-floor-list");
  const commitProgressEl = document.getElementById("commit-progress");
  const cancelCommitButton = document.getElementById("mint-cancel-commit");

  if (!statusEl || !mintButton || !amountInput) {
    return;
  }

  let walletState = null;
  const devChecklist =
    IS_DEV && isDebugEnabled() ? initDevChecklist(statusEl.parentElement) : null;
  const floorCache = new Map();
  let currentMintPriceWei = null;

  amountInput.readOnly = true;

  function setCommitProgress(visible) {
    if (!commitProgressEl) {
      return;
    }
    commitProgressEl.classList.toggle("is-visible", visible);
  }

  function setCancelCommitVisible(visible) {
    if (!cancelCommitButton) {
      return;
    }
    cancelCommitButton.classList.toggle("is-hidden", !visible);
  }

  let readProviderPromise = null;

  async function getReadProvider() {
    if (typeof window !== "undefined" && window.__CUBIXLES_TEST_HOOKS__ && walletState?.provider) {
      return new BrowserProvider(walletState.provider);
    }
    const chain = getChainConfig(CUBIXLES_CONTRACT.chainId);
    const rpcUrls = chain?.rpcUrls ?? [];
    if (rpcUrls.length) {
      if (readProviderPromise) {
        return readProviderPromise;
      }
      const fallbacks = rpcUrls;
      readProviderPromise = (async () => {
        for (const url of fallbacks) {
          const candidate = new JsonRpcProvider(url);
          try {
            await candidate.getBlockNumber();
            return candidate;
          } catch (error) {
            continue;
          }
        }
        if (walletState?.provider) {
          return new BrowserProvider(walletState.provider);
        }
        return null;
      })();
      return readProviderPromise;
    }
    if (walletState?.provider) {
      return new BrowserProvider(walletState.provider);
    }
    return null;
  }

  async function refreshCommitPresence() {
    if (!cancelCommitButton) {
      return;
    }
    if (!walletState || walletState.status !== "connected") {
      setCancelCommitVisible(false);
      return;
    }
    if (isZeroAddress(CUBIXLES_CONTRACT.address) || !CUBIXLES_CONTRACT.abi?.length) {
      setCancelCommitVisible(false);
      return;
    }
    try {
      const readProvider = await getReadProvider();
      if (!readProvider) {
        setCancelCommitVisible(false);
        return;
      }
      const network = await readProvider.getNetwork();
      if (Number(network.chainId) !== CUBIXLES_CONTRACT.chainId) {
        setCancelCommitVisible(false);
        return;
      }
      const readContract = new Contract(
        CUBIXLES_CONTRACT.address,
        CUBIXLES_CONTRACT.abi,
        readProvider
      );
      const commit = await readContract.mintCommitByMinter(walletState.address);
      const blockNumber = BigInt(commit?.blockNumber ?? commit?.[1] ?? 0);
      setCancelCommitVisible(blockNumber > 0n);
    } catch (error) {
      setCancelCommitVisible(false);
    }
  }

  function setStatus(message, tone = "neutral") {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", tone === "error");
    statusEl.classList.toggle("is-success", tone === "success");
    const isStay =
      typeof message === "string" &&
      message.toLowerCase().includes("please stay on this page");
    statusEl.classList.toggle("is-stay", isStay);
    statusEl.classList.remove("mint-status-pop");
    void statusEl.offsetHeight;
    statusEl.classList.add("mint-status-pop");
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
    const chain = getChainConfig(CUBIXLES_CONTRACT.chainId);
    const explorer = chain?.explorer || "";
    return explorer ? `${explorer}/tx/${hash}` : "";
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

  function setDisabled(disabled) {
    mintButton.disabled = disabled;
    amountInput.disabled = disabled;
    if (cancelCommitButton) {
      cancelCommitButton.disabled = disabled;
    }
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
    if (isZeroAddress(CUBIXLES_CONTRACT.address) || !CUBIXLES_CONTRACT.abi?.length) {
      return null;
    }
    try {
      const readProvider = await getReadProvider();
      if (!readProvider) {
        return null;
      }
      const network = await readProvider.getNetwork();
      if (Number(network.chainId) !== CUBIXLES_CONTRACT.chainId) {
        return null;
      }
      const contract = new Contract(
        CUBIXLES_CONTRACT.address,
        CUBIXLES_CONTRACT.abi,
        readProvider
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

  function toBigInt(value, fallback = 0n) {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value === "bigint") {
      return value;
    }
    if (typeof value === "number") {
      return BigInt(Math.trunc(value));
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return fallback;
      }
      return BigInt(trimmed);
    }
    if (typeof value === "object" && typeof value.toString === "function") {
      const text = value.toString();
      if (!text) {
        return fallback;
      }
      return BigInt(text);
    }
    return fallback;
  }

  async function ensureBalanceForTransaction({
    provider,
    contract,
    method,
    args,
    valueWei,
    label,
  }) {
    if (!provider || !contract || !walletState?.address || valueWei == null) {
      return;
    }
    const overrides = valueWei ? { value: valueWei } : {};
    let gasLimit = null;
    try {
      gasLimit = await contract.estimateGas[method](...args, overrides);
    } catch (error) {
      return;
    }
    const [balance, feeData] = await Promise.all([
      provider.getBalance(walletState.address),
      provider.getFeeData(),
    ]);
    const gasPrice = feeData?.maxFeePerGas ?? feeData?.gasPrice;
    if (!gasPrice) {
      return;
    }
    const estimatedGas =
      typeof gasLimit === "bigint" ? gasLimit : BigInt(gasLimit);
    const required = valueWei + estimatedGas * BigInt(gasPrice);
    if (balance < required) {
      const shortfall = required - balance;
      const shortfallEth = formatEthFromWei(shortfall);
      const step = label ? `${label} ` : "";
      const valueLabel = valueWei ? "price + " : "";
      throw new Error(
        `Insufficient ETH for ${step}${valueLabel}gas. Add about ${shortfallEth} ETH and retry.`
      );
    }
  }

  async function ensureBalanceForMint({ provider, contract, args, valueWei }) {
    return ensureBalanceForTransaction({
      provider,
      contract,
      method: "mint",
      args,
      valueWei,
      label: "mint",
    });
  }

  async function waitForRevealBlock({ readContract, commitment, readProvider }) {
    const deadline = Date.now() + 60_000;
    const expected = commitment?.toLowerCase?.() ?? "";
    while (Date.now() < deadline) {
      const commit = await readContract.mintCommitByMinter(walletState.address);
      const commitHash =
        (commit?.commitment ?? commit?.[0] ?? "").toString().toLowerCase();
      if (!commitHash || /^0x0+$/.test(commitHash)) {
        throw new Error("Commit missing. Please re-commit.");
      }
      if (expected && commitHash !== expected) {
        throw new Error(
          "Pending commit does not match your selection. Please re-commit."
        );
      }
      const commitBlock = BigInt(commit?.blockNumber ?? commit?.[1] ?? 0);
      if (!commitBlock) {
        throw new Error("Commit block unavailable.");
      }
      const revealBlock = commitBlock + COMMIT_REVEAL_DELAY_BLOCKS;
      const expiryBlock = revealBlock + COMMIT_REVEAL_WINDOW_BLOCKS;
      const latestBlock = BigInt(await readProvider.getBlockNumber());
      if (latestBlock > expiryBlock) {
        throw new Error("Commit expired. Please re-commit.");
      }
      if (latestBlock > revealBlock) {
        return commit;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Reveal pending. Please retry in a moment.");
  }

  function updateMintPriceNote() {
    if (!mintPriceNoteEl) {
      return;
    }
    const chain = getChainConfig(CUBIXLES_CONTRACT.chainId);
    if (chain?.supportsLess) {
      mintPriceNoteEl.innerHTML = `Mint price rises as <a class="ui-link" href="https://less.ripe.wtf/about" target="_blank" rel="noreferrer">$LESS</a> supply drops.`;
      return;
    }
    mintPriceNoteEl.textContent =
      "Base pricing is linear + immutable: 0.0012 ETH base, +0.000036 ETH per mint.";
  }

  async function refreshMintPrice() {
    const onchain = await fetchMintPriceFromContract();
    const chain = getChainConfig(CUBIXLES_CONTRACT.chainId);
    if (onchain) {
      currentMintPriceWei = BigInt(onchain);
    } else if (chain?.supportsLess) {
      const computed = computeMintPriceFromSupply();
      currentMintPriceWei = computed;
    } else {
      currentMintPriceWei = null;
    }
    state.mintPriceWei = currentMintPriceWei;
    if (mintPriceEl) {
      mintPriceEl.textContent = currentMintPriceWei
        ? `Mint price: ${formatEthFromWei(currentMintPriceWei)} ETH.`
        : "Mint price: —";
    }
    if (amountInput) {
      amountInput.value = currentMintPriceWei ? formatEthFromWei(currentMintPriceWei) : "";
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
      floorListEl.classList.add("is-empty");
      state.sumFloorEth = 0;
      if (capture) {
        state.floorSnapshotAt = new Date().toISOString();
      }
      document.dispatchEvent(new CustomEvent("floor-snapshot-change"));
      return;
    }

    floorListEl.classList.remove("is-empty");
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
      if (mintButton) {
        mintButton.classList.remove("is-hooked");
      }
      setStatus("Connect your wallet to mint.");
      setDisabled(true);
      return;
    }
    if (isZeroAddress(CUBIXLES_CONTRACT.address)) {
      setStatus("Deploy contract and update address before minting.", "error");
      setDisabled(true);
      return;
    }
    if (state.nftSelection.length < 1 || state.nftSelection.length > 6) {
      setStatus("Select 1 to 6 NFTs to mint.");
      setDisabled(true);
      return;
    }
    if (!CUBIXLES_CONTRACT.abi || CUBIXLES_CONTRACT.abi.length === 0) {
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
    refreshCommitPresence();
  });
  subscribeActiveChain(() => {
    updateEligibility();
    updateMintPriceNote();
    refreshMintPrice();
  });
  updateMintPriceNote();

  document.addEventListener("nft-selection-change", () => {
    updateEligibility();
    refreshFloorSnapshot();
  });
  document.addEventListener("less-supply-change", () => {
    refreshMintPrice();
  });

  if (cancelCommitButton) {
    cancelCommitButton.addEventListener("click", async () => {
      let contract = null;
      if (!walletState || walletState.status !== "connected") {
        setStatus("Connect your wallet to cancel the commit.", "error");
        return;
      }
      setDisabled(true);
      try {
        const provider = new BrowserProvider(walletState.provider);
        const walletNetwork = await provider.getNetwork();
        const walletChainId = Number(walletNetwork.chainId);
        if (walletChainId !== CUBIXLES_CONTRACT.chainId) {
          setStatus(
            `Approve network switch to ${formatChainName(
              CUBIXLES_CONTRACT.chainId
            )} in your wallet.`,
            "error"
          );
          const switched = await switchToActiveChain();
          if (!switched) {
            throw new Error(
              `Wallet on ${formatChainName(walletChainId)}. Switch to ${formatChainName(
                CUBIXLES_CONTRACT.chainId
              )} to cancel the commit.`
            );
          }
          const refreshedNetwork = await provider.getNetwork();
          const refreshedChainId = Number(refreshedNetwork.chainId);
          if (refreshedChainId !== CUBIXLES_CONTRACT.chainId) {
            throw new Error(
              `Wallet on ${formatChainName(refreshedChainId)}. Switch to ${formatChainName(
                CUBIXLES_CONTRACT.chainId
              )} to cancel the commit.`
            );
          }
        }
        const signer = await provider.getSigner();
        contract = new Contract(
          CUBIXLES_CONTRACT.address,
          CUBIXLES_CONTRACT.abi,
          signer
        );
        await ensureBalanceForTransaction({
          provider,
          contract,
          method: "cancelCommit",
          args: [],
          valueWei: 0n,
          label: "cancel",
        });
        setStatus("Confirm commit cancellation in your wallet.");
        await contract.cancelCommit.staticCall();
        const cancelTx = await contract.cancelCommit();
        showToast({
          title: "Commit cancellation submitted",
          message: `Cancellation broadcast to ${formatChainName(CUBIXLES_CONTRACT.chainId)}.`,
          tone: "neutral",
          links: [{ label: "View tx", href: buildTxUrl(cancelTx.hash) }],
        });
        setStatus("Waiting for cancellation confirmation...");
        await cancelTx.wait();
        clearStoredCommit(CUBIXLES_CONTRACT.chainId, walletState.address);
        setCancelCommitVisible(false);
        setStatus("Commit canceled.", "success");
      } catch (error) {
        let message = formatError(error, {
          iface: contract?.interface || CUBIXLES_INTERFACE,
        });
        if (message === "Mint failed.") {
          message = "Cancel failed.";
        }
        setStatus(message, "error");
        showToast({
          title: "Cancel failed",
          message,
          tone: "error",
        });
      } finally {
        setDisabled(false);
        refreshCommitPresence();
      }
    });
  }

  mintButton.addEventListener("click", async () => {
    let contract = null;
    mintButton.classList.add("is-hooked");
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
      const walletNetwork = await provider.getNetwork();
      const walletChainId = Number(walletNetwork.chainId);
      if (!isSupportedChainId(walletChainId)) {
        throw new Error("Unsupported wallet network. Switch to mainnet or Base.");
      }
      if (walletChainId !== CUBIXLES_CONTRACT.chainId) {
        setStatus(
          `Approve network switch to ${formatChainName(
            CUBIXLES_CONTRACT.chainId
          )} in your wallet.`,
          "error"
        );
        const switched = await switchToActiveChain();
        if (!switched) {
          throw new Error(
            `Wallet on ${formatChainName(walletChainId)}. Switch to ${formatChainName(
              CUBIXLES_CONTRACT.chainId
            )} to mint.`
          );
        }
        const refreshedNetwork = await provider.getNetwork();
        const refreshedChainId = Number(refreshedNetwork.chainId);
        if (refreshedChainId !== CUBIXLES_CONTRACT.chainId) {
          throw new Error(
            `Wallet on ${formatChainName(refreshedChainId)}. Switch to ${formatChainName(
              CUBIXLES_CONTRACT.chainId
            )} to mint.`
          );
        }
      }
      const readProvider = await getReadProvider();
      if (!readProvider) {
        throw new Error("Read-only RPC unavailable. Try again shortly.");
      }
      const readNetwork = await readProvider.getNetwork();
      const readChainId = Number(readNetwork.chainId);
      if (readChainId !== walletChainId) {
        throw new Error(
          `Network mismatch. Wallet on ${formatChainName(
            walletChainId
          )}, RPC on ${formatChainName(readChainId)}.`
        );
      }
      if (!currentMintPriceWei) {
        throw new Error("Mint price unavailable. Try again shortly.");
      }
      const signer = await provider.getSigner();
      const readContract = new Contract(
        CUBIXLES_CONTRACT.address,
        CUBIXLES_CONTRACT.abi,
        readProvider
      );
      contract = new Contract(
        CUBIXLES_CONTRACT.address,
        CUBIXLES_CONTRACT.abi,
        signer
      );
      let salt = null;
      let commitment = null;
      const refsForContract = state.nftSelection.map((nft) => ({
        contractAddress: nft.contractAddress,
        tokenId: BigInt(nft.tokenId),
      }));
      const refsCanonical = sortRefsCanonically(refsForContract);
      const refsHash = computeRefsHash(refsCanonical);
      const latestBlock = BigInt(await readProvider.getBlockNumber());
      let existingCommit = null;
      let existingBlock = 0n;
      try {
        existingCommit = await readContract.mintCommitByMinter(walletState.address);
        existingBlock = BigInt(existingCommit?.blockNumber ?? 0n);
      } catch (error) {
        try {
          existingCommit = await contract.mintCommitByMinter(walletState.address);
          existingBlock = BigInt(existingCommit?.blockNumber ?? 0n);
        } catch (fallbackError) {
          console.warn("Commit state read failed.", error, fallbackError);
          throw new Error("Commit state unavailable. Please retry.");
        }
      }
      const storedCommit = loadStoredCommit(
        CUBIXLES_CONTRACT.chainId,
        walletState.address
      );
      let commitBlockNumber = null;
      let usingExistingCommit = false;
      if (existingBlock > 0n) {
        setCancelCommitVisible(true);
        const revealBlock = existingBlock + COMMIT_REVEAL_DELAY_BLOCKS;
        const expiryBlock = revealBlock + COMMIT_REVEAL_WINDOW_BLOCKS;
        if (latestBlock <= expiryBlock) {
          const storedSalt = storedCommit?.salt;
          if (!storedSalt) {
            throw new Error(
              "Pending commit exists but local salt is missing. Wait for it to expire before recommitting."
            );
          }
          const candidateCommitment = computeCommitmentHash({
            minter: walletState.address,
            salt: storedSalt,
            refsHash,
          });
          const existingCommitment = (
            existingCommit?.commitment ?? existingCommit?.[0] ?? ""
          ).toString();
          if (
            !candidateCommitment ||
            existingCommitment.toLowerCase() !== candidateCommitment.toLowerCase()
          ) {
            throw new Error(
              "Pending commit exists. Use the same NFT selection as your last commit or wait for it to expire."
            );
          }
          if (latestBlock <= revealBlock) {
            throw new Error("Commit pending. Wait for the reveal window to open.");
          }
          salt = storedSalt;
          commitment = candidateCommitment;
          commitBlockNumber = existingBlock;
          usingExistingCommit = true;
        } else {
          clearStoredCommit(CUBIXLES_CONTRACT.chainId, walletState.address);
        }
      }
      if (existingBlock === 0n && storedCommit) {
        clearStoredCommit(CUBIXLES_CONTRACT.chainId, walletState.address);
      }
      if (!salt) {
        salt = generateSalt();
        commitment = computeCommitmentHash({
          minter: walletState.address,
          salt,
          refsHash,
        });
      }
      if (!commitment) {
        throw new Error("Commitment unavailable. Please retry.");
      }
      const previewTokenId = await readContract.previewTokenId(
        salt,
        refsCanonical,
        { from: walletState.address }
      );
      const tokenId = BigInt(previewTokenId);
      const externalUrl = buildTokenViewUrl(tokenId.toString());
      if (!externalUrl) {
        throw new Error("Token viewer URL is not configured.");
      }
      const needsCommitTx = commitBlockNumber === null;
      const totalSteps = needsCommitTx ? 3 : 2;
      const metadataStep = needsCommitTx ? 2 : 1;
      const mintStep = needsCommitTx ? 3 : 2;

      if (needsCommitTx) {
        showToast({
          title: "Three-step mint",
          message: "You will confirm three wallet prompts: commit, metadata, then mint.",
          tone: "neutral",
        });
        await ensureBalanceForTransaction({
          provider,
          contract,
          method: "commitMint",
          args: [commitment],
          valueWei: 0n,
          label: "commit",
        });
        setStatus(`Step 1/${totalSteps}: confirm commit in your wallet.`);
        await contract.commitMint.staticCall(commitment);
        const commitTx = await contract.commitMint(commitment);
        showToast({
          title: "Commit submitted",
          message: `Commit broadcast to ${formatChainName(CUBIXLES_CONTRACT.chainId)}.`,
          tone: "neutral",
          links: [{ label: "View tx", href: buildTxUrl(commitTx.hash) }],
        });
        setStatus(
          "Waiting for commit confirmation. Please stay on this page while the transaction is being committed."
        );
        setCommitProgress(true);
        const commitReceipt = await commitTx.wait();
        setCommitProgress(false);
        commitBlockNumber = commitReceipt?.blockNumber;
        if (!commitBlockNumber) {
          throw new Error("Commit block unavailable.");
        }
        setCancelCommitVisible(true);
        saveStoredCommit(CUBIXLES_CONTRACT.chainId, walletState.address, {
          commitment,
          salt,
          refsHash,
          blockNumber: commitBlockNumber.toString(),
        });
      } else {
        setStatus(
          usingExistingCommit
            ? "Using existing commit. Waiting for reveal block..."
            : "Preparing mint..."
        );
      }

      setStatus("Waiting for reveal block...");
      setCommitProgress(true);
      const commitState = await waitForRevealBlock({
        readContract,
        commitment,
        readProvider,
      });
      setCommitProgress(false);

      const expectedPaletteIndexRaw = await readContract.previewPaletteIndex(
        walletState.address
      );
      const expectedPaletteIndex = Number(expectedPaletteIndexRaw);
      if (!Number.isFinite(expectedPaletteIndex)) {
        throw new Error("Palette index unavailable.");
      }
      const paletteManifest = await loadPaletteManifest();
      const paletteEntry = getPaletteEntryByIndex(expectedPaletteIndex, paletteManifest);
      const paletteImagePath = buildPaletteImagePath(paletteEntry);
      if (!paletteImagePath) {
        throw new Error("Palette image path missing.");
      }
      const paletteImageIpfsUrl = buildPaletteImageUrl(paletteEntry);
      if (!paletteImageIpfsUrl) {
        throw new Error("Palette image URL unavailable.");
      }
      const imagePathHash = normalizeBytes32(
        solidityPackedKeccak256(["string"], [paletteImagePath]),
        "Image path hash"
      );
      const refsFaces = normalizeRefsForMetadata(state.nftSelection);
      const refsCanonicalForMetadata = normalizeRefsForMetadata(refsCanonical);
      const provenanceBundle = buildProvenanceBundle(
        state.nftSelection,
        walletState.address,
        CUBIXLES_CONTRACT.chainId
      );
      const lessSupplyMint =
        state.lessSupplyNow != null
          ? state.lessSupplyNow.toString()
          : state.lessTotalSupply != null
            ? state.lessTotalSupply.toString()
            : "0";
      const animationUrl = getAnimationUrl();
      const metadataPayload = buildMintMetadata({
        tokenId: tokenId.toString(),
        minter: walletState.address,
        chainId: CUBIXLES_CONTRACT.chainId,
        selection: state.nftSelection,
        provenanceBundle,
        refsFaces,
        refsCanonical: refsCanonicalForMetadata,
        salt,
        animationUrl,
        externalUrl,
        imageUrl: paletteImageIpfsUrl,
        imageIpfsUrl: paletteImageIpfsUrl,
        paletteEntry,
        paletteIndex: expectedPaletteIndex,
        paletteImageUrl: paletteImageIpfsUrl,
        lessSupplyMint,
      });

      setStatus("Pinning metadata...");
      const { tokenURI, metadataHash: rawMetadataHash } = await pinTokenMetadata({
        metadata: metadataPayload,
        signer,
        address: walletState.address,
      });
      const metadataHash = normalizeBytes32(rawMetadataHash, "Metadata hash");
      const metadataCommitted = Boolean(
        commitState?.metadataCommitted ?? commitState?.[6]
      );
      if (metadataCommitted) {
        const committedMetadataHash = normalizeBytes32(
          commitState?.metadataHash ?? commitState?.[4] ?? "",
          "Committed metadata hash"
        );
        const committedImagePathHash = normalizeBytes32(
          commitState?.imagePathHash ?? commitState?.[5] ?? "",
          "Committed image path hash"
        );
        if (
          committedMetadataHash.toLowerCase() !== metadataHash.toLowerCase() ||
          committedImagePathHash.toLowerCase() !== imagePathHash.toLowerCase()
        ) {
          throw new Error(
            "Metadata already committed for this mint. Use the same selection or wait for it to expire."
          );
        }
      } else {
        await ensureBalanceForTransaction({
          provider,
          contract,
          method: "commitMetadata",
          args: [metadataHash, imagePathHash, expectedPaletteIndex],
          valueWei: 0n,
          label: "metadata",
        });
        setStatus(`Step ${metadataStep}/${totalSteps}: confirm metadata in your wallet.`);
        await contract.commitMetadata.staticCall(
          metadataHash,
          imagePathHash,
          expectedPaletteIndex
        );
        const metadataTx = await contract.commitMetadata(
          metadataHash,
          imagePathHash,
          expectedPaletteIndex
        );
        showToast({
          title: "Metadata committed",
          message: `Metadata commitment broadcast to ${formatChainName(
            CUBIXLES_CONTRACT.chainId
          )}.`,
          tone: "neutral",
          links: [{ label: "View tx", href: buildTxUrl(metadataTx.hash) }],
        });
        setStatus("Waiting for metadata confirmation...");
        await metadataTx.wait();
      }

      if (devChecklist) {
        const diagnostics = buildDiagnostics({
          selection: state.nftSelection,
          externalUrl,
          amountInput: amountInput.value,
          walletAddress: walletState.address,
          mintPriceWei: currentMintPriceWei,
          tokenId: tokenId.toString(),
          tokenURI,
          metadataHash,
          imagePath: paletteImagePath,
          paletteIndex: expectedPaletteIndex,
        });
        logDiagnostics(diagnostics, devChecklist);
      }
      state.currentCubeTokenId = tokenId;
      document.dispatchEvent(new CustomEvent("cube-token-change"));
      const mintValueWei = currentMintPriceWei;
      const overrides = { value: mintValueWei };
      await ensureBalanceForMint({
        provider,
        contract,
        args: [
          salt,
          refsCanonical,
          expectedPaletteIndex,
          tokenURI,
          metadataHash,
          imagePathHash,
        ],
        valueWei: mintValueWei,
      });

      setStatus(`Step ${mintStep}/${totalSteps}: confirm mint in your wallet.`);
      await contract.mint.staticCall(
        salt,
        refsCanonical,
        expectedPaletteIndex,
        tokenURI,
        metadataHash,
        imagePathHash,
        overrides
      );
      const tx = await contract.mint(
        salt,
        refsCanonical,
        expectedPaletteIndex,
        tokenURI,
        metadataHash,
        imagePathHash,
        overrides
      );
      showToast({
        title: "Mint submitted",
        message: `Transaction broadcast to ${formatChainName(CUBIXLES_CONTRACT.chainId)}.`,
        tone: "neutral",
        links: [{ label: "View tx", href: buildTxUrl(tx.hash) }],
      });
      setStatus(
        "Waiting for mint confirmation. Please stay on this page while the transaction is being committed."
      );
      const receipt = await tx.wait();
      clearStoredCommit(CUBIXLES_CONTRACT.chainId, walletState.address);
      setCancelCommitVisible(false);
      const mintedTokenId = extractMintedTokenId(receipt, contract);
      if (mintedTokenId !== null && mintedTokenId !== undefined) {
        state.currentCubeTokenId = BigInt(mintedTokenId);
        document.dispatchEvent(new CustomEvent("cube-token-change"));
      }
      setStatus("Mint confirmed.", "success");
      triggerConfetti();
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
      const message = formatError(error, {
        iface: contract?.interface || CUBIXLES_INTERFACE,
      });
      setStatus(message, "error");
      showToast({
        title: "Mint failed",
        message,
        tone: "error",
      });
    } finally {
      setCommitProgress(false);
      setDisabled(false);
      refreshCommitPresence();
      updateEligibility();
    }
  });

  refreshMintPrice();

  updateEligibility();
  refreshCommitPresence();
  refreshFloorSnapshot();

  subscribeActiveChain(() => {
    floorCache.clear();
    readProviderPromise = null;
    refreshMintPrice();
    refreshFloorSnapshot();
    updateEligibility();
    refreshCommitPresence();
  });
}

function buildDiagnostics({
  selection,
  externalUrl,
  amountInput,
  walletAddress,
  mintPriceWei,
  tokenId,
  tokenURI,
  metadataHash,
  imagePath,
  paletteIndex,
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
      externalUrl: externalUrl || null,
      tokenURI: tokenURI || null,
      imagePath: imagePath || null,
      metadataHash: metadataHash || null,
      paletteIndex:
        typeof paletteIndex === "number" && Number.isFinite(paletteIndex)
          ? paletteIndex
          : null,
    },
  };
}

function logDiagnostics(diagnostics, devChecklist) {
  if (!devChecklist) {
    return;
  }
  console.info("[cubixles][mint] economics", diagnostics.economics);
  devChecklist.mark("economics");
  console.info("[cubixles][mint] uris", diagnostics.uris);
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
