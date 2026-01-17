import { BrowserProvider, Contract, formatEther } from "ethers";
import { BUILDER_CONTRACT } from "../../config/builder-contracts";
import { formatChainName, subscribeActiveChain } from "../../config/chains.js";
import { state } from "../../app/app-state.js";
import { subscribeWallet, switchToActiveChain } from "../wallet/wallet.js";

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
  if (!floorWei || floorWei === 0n) {
    return "0.0010 (fallback)";
  }
  return formatEthFromWei(floorWei);
}

export function initBuilderMintUi() {
  const statusEl = document.getElementById("mint-status");
  const mintButton = document.getElementById("mint-submit");
  const amountInput = document.getElementById("mint-payment");
  const mintPriceEl = document.getElementById("mint-price");
  const floorSummaryEl = document.getElementById("mint-floor-summary");
  const floorListEl = document.getElementById("mint-floor-list");
  const errorEl = document.getElementById("builder-error");
  const debugEl = document.getElementById("builder-debug");

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

  function setError(message) {
    if (!errorEl) {
      return;
    }
    errorEl.textContent = message || "-";
    errorEl.classList.toggle("is-hidden", !message);
  }

  function setDebug(lines) {
    if (!debugEl) {
      return;
    }
    const text = lines.filter(Boolean).join("\n");
    debugEl.textContent = text || "-";
    debugEl.classList.toggle("is-hidden", !text);
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
    setDebug(["quote: requesting..."]);

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
        setDebug([
          "quote: error",
          data?.requestId ? `requestId: ${data.requestId}` : null,
        ]);
        return null;
      }
      if (!data?.signature || !data?.quote) {
        setError("Quote response missing signature.");
        setDebug(["quote: error", "missing signature or quote payload"]);
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
      setDebug([
        "quote: ready",
        data?.requestId ? `requestId: ${data.requestId}` : null,
        data?.verifyingContract ? `verifier: ${data.verifyingContract}` : null,
      ]);
      return {
        refs: selection.map((nft) => ({
          contractAddress: nft.contractAddress,
          tokenId: BigInt(nft.tokenId),
        })),
        floorsWei,
        quote,
        signature: data.signature,
        mintPriceWei,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quote failed.";
      setError(message);
      setDebug(["quote: error", message]);
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
    setStatus("Submitting builder mint...");
    setError("");

    try {
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
      const tx = await contract.mintBuilders(
        currentQuote.refs,
        currentQuote.floorsWei,
        currentQuote.quote,
        currentQuote.signature,
        { value: currentQuote.mintPriceWei }
      );
      setStatus("Builder mint submitted.");
      setDebug([
        "mint: submitted",
        tx?.hash ? `tx: ${tx.hash}` : null,
      ]);
      await tx.wait();
      setStatus("Builder mint confirmed.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mint failed.";
      setError(message);
      setStatus(message, "error");
      setDebug(["mint: error", message]);
    } finally {
      isMinting = false;
      setDisabled(false);
    }
  }

  mintButton.addEventListener("click", () => {
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
