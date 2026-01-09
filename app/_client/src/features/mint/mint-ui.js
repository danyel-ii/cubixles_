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
  subscribeActiveChain,
} from "../../config/chains.js";
import { buildTokenViewUrl } from "../../config/links.js";
import { getCollectionFloorSnapshot } from "../../data/nft/floor.js";
import { subscribeWallet } from "../wallet/wallet.js";
import { state } from "../../app/app-state.js";
import { computeRefsHash, sortRefsCanonically } from "./refs.js";

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
  MintRandomnessPending: "Randomness pending. Please retry in a moment.",
  MintCommitEmpty: "Commit missing. Please retry.",
  MintCommitActive:
    "Existing commit still active. Use the same selection or wait for it to expire.",
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
  if (code === "INSUFFICIENT_FUNDS" || /insufficient funds/i.test(message)) {
    return "Insufficient ETH to cover gas + value.";
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
        return null;
      })();
      return readProviderPromise;
    }
    if (walletState?.provider) {
      return new BrowserProvider(walletState.provider);
    }
    return null;
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

  async function ensureBalanceForMint({ provider, contract, args, valueWei }) {
    if (!provider || !contract || !walletState?.address || valueWei == null) {
      return;
    }
    let gasLimit = null;
    try {
      gasLimit = await contract.estimateGas.mint(...args, { value: valueWei });
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
      throw new Error(
        `Insufficient ETH for mint price + gas. Add about ${shortfallEth} ETH and retry.`
      );
    }
  }

  async function waitForRandomness({ readContract, commitment }) {
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
      const ready = Boolean(commit?.randomnessReady ?? commit?.[4]);
      if (ready) {
        return commit;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Randomness pending. Please retry in a moment.");
  }

  function updateMintPriceNote() {
    if (!mintPriceNoteEl) {
      return;
    }
    const chain = getChainConfig(CUBIXLES_CONTRACT.chainId);
    if (chain?.supportsLess) {
      mintPriceNoteEl.innerHTML = `Mint price rises as <a class="ui-link" href="https://less.ripe.wtf/about" target="_blank" rel="noreferrer">$LESS</a> supply drops (more burns = higher cost).`;
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

  mintButton.addEventListener("click", async () => {
    let contract = null;
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
      const readProvider = await getReadProvider();
      if (!readProvider) {
        throw new Error("Read-only RPC unavailable. Try again shortly.");
      }
      const network = await readProvider.getNetwork();
      if (Number(network.chainId) !== CUBIXLES_CONTRACT.chainId) {
        throw new Error(
          `Switch wallet to ${formatChainName(CUBIXLES_CONTRACT.chainId)}.`
        );
      }
      if (!currentMintPriceWei) {
        throw new Error("Mint price unavailable. Try again shortly.");
      }
      const provider = new BrowserProvider(walletState.provider);
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
      let supportsCommitReveal = true;
      let existingCommit = null;
      let existingBlock = 0n;
      try {
        existingCommit = await readContract.mintCommitByMinter(walletState.address);
        existingBlock = BigInt(existingCommit?.blockNumber ?? 0n);
      } catch (error) {
        supportsCommitReveal = false;
      }
      const storedCommit = loadStoredCommit(
        CUBIXLES_CONTRACT.chainId,
        walletState.address
      );
      let commitBlockNumber = null;
      let usingExistingCommit = false;
      if (supportsCommitReveal && existingBlock > 0n) {
        const expiryBlock =
          existingBlock + COMMIT_REVEAL_DELAY_BLOCKS + COMMIT_REVEAL_WINDOW_BLOCKS;
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
          const earliestBlock = existingBlock + COMMIT_REVEAL_DELAY_BLOCKS;
          if (latestBlock < earliestBlock) {
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
      if (supportsCommitReveal && existingBlock === 0n && storedCommit) {
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
      if (supportsCommitReveal && commitBlockNumber === null) {
        showToast({
          title: "Two-step mint",
          message: "You will confirm two wallet prompts: commit, then mint.",
          tone: "neutral",
        });
        setStatus("Step 1/2: confirm commit in your wallet.");
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
        saveStoredCommit(CUBIXLES_CONTRACT.chainId, walletState.address, {
          commitment,
          salt,
          refsHash,
          blockNumber: commitBlockNumber.toString(),
        });
      } else if (supportsCommitReveal) {
        setStatus(
          usingExistingCommit
            ? "Using existing commit. Waiting for randomness..."
            : "Preparing mint..."
        );
      } else {
        showToast({
          title: "Legacy mint flow",
          message:
            "This contract does not use commit-reveal. You will confirm a single mint prompt.",
          tone: "neutral",
        });
        setStatus("Preparing mint...");
      }
      if (supportsCommitReveal) {
        setStatus("Waiting for randomness...");
        setCommitProgress(true);
        await waitForRandomness({ readContract, commitment });
        setCommitProgress(false);
      }
      if (devChecklist) {
        const diagnostics = buildDiagnostics({
          selection: state.nftSelection,
          externalUrl,
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
      await ensureBalanceForMint({
        provider,
        contract,
        args: [salt, refsCanonical],
        valueWei: currentMintPriceWei,
      });

      setStatus("Step 2/2: confirm mint in your wallet.");
      const tx = await contract.mint(salt, refsCanonical, overrides);
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
      updateEligibility();
    }
  });

  refreshMintPrice();

  updateEligibility();
  refreshFloorSnapshot();

  subscribeActiveChain(() => {
    floorCache.clear();
    readProviderPromise = null;
    refreshMintPrice();
    refreshFloorSnapshot();
    updateEligibility();
  });
}

function buildDiagnostics({
  selection,
  externalUrl,
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
      externalUrl: externalUrl || null,
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
