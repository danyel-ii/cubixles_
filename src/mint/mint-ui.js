import { BrowserProvider, Contract, parseEther } from "ethers";
import { ICECUBE_CONTRACT } from "../config/contracts";
import { buildProvenanceBundle } from "../nft/indexer";
import { subscribeWallet } from "../wallet/wallet";
import { state } from "../app/app-state.js";

const SEPOLIA_CHAIN_ID = 11155111;

function toBase64Json(value) {
  const json = JSON.stringify(value);
  const utf8 = encodeURIComponent(json);
  const safe = unescape(utf8);
  return `data:application/json;base64,${btoa(safe)}`;
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Mint failed.";
}

function isZeroAddress(address) {
  return !address || address === "0x0000000000000000000000000000000000000000";
}

export function initMintUi() {
  const statusEl = document.getElementById("mint-status");
  const mintButton = document.getElementById("mint-submit");
  const amountInput = document.getElementById("mint-payment");

  if (!statusEl || !mintButton || !amountInput) {
    return;
  }

  let walletState = null;

  function setStatus(message, tone = "neutral") {
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", tone === "error");
    statusEl.classList.toggle("is-success", tone === "success");
  }

  function setDisabled(disabled) {
    mintButton.disabled = disabled;
    amountInput.disabled = disabled;
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
    if (state.nftSelection.length !== 3) {
      setStatus("Select exactly 3 NFTs to mint.");
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

  subscribeWallet((next) => {
    walletState = next;
    updateEligibility();
  });

  document.addEventListener("nft-selection-change", () => {
    updateEligibility();
  });

  mintButton.addEventListener("click", async () => {
    if (!walletState || walletState.status !== "connected") {
      setStatus("Connect your wallet to mint.", "error");
      return;
    }
    if (state.nftSelection.length !== 3) {
      setStatus("Select exactly 3 NFTs to mint.", "error");
      return;
    }
    setDisabled(true);
    setStatus("Building provenance bundle...");
    try {
      const provider = new BrowserProvider(walletState.provider);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        throw new Error("Switch wallet to Sepolia.");
      }
      const signer = await provider.getSigner();
      const contract = new Contract(
        ICECUBE_CONTRACT.address,
        ICECUBE_CONTRACT.abi,
        signer
      );
      const bundle = await buildProvenanceBundle(
        state.nftSelection,
        walletState.address,
        SEPOLIA_CHAIN_ID
      );
      const primaryImage = state.nftSelection[0]?.image?.resolved ?? null;
      const metadata = {
        name: "IceCube",
        description: "IceCube mint gated by 3 NFTs.",
        image: primaryImage,
        provenance: bundle,
      };
      const tokenUri = toBase64Json(metadata);
      const refs = state.nftSelection.map((nft) => ({
        contractAddress: nft.contractAddress,
        tokenId: BigInt(nft.tokenId),
      }));
      const valueRaw = amountInput.value.trim();
      const overrides = valueRaw ? { value: parseEther(valueRaw) } : {};

      setStatus("Submitting mint transaction...");
      const tx = await contract.mint(tokenUri, refs, overrides);
      setStatus("Waiting for confirmation...");
      await tx.wait();
      setStatus("Mint confirmed.", "success");
    } catch (error) {
      setStatus(formatError(error), "error");
    } finally {
      setDisabled(false);
      updateEligibility();
    }
  });

  updateEligibility();
}
