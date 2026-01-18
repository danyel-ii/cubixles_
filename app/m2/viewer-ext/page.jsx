"use client";

import { useEffect, useMemo, useState } from "react";
import { Interface } from "ethers";

import PaperCubeGrid from "../../_components/PaperCubeGrid.jsx";
import builderDeployment from "../../../contracts/deployments/builder-mainnet.json";
import { buildImageCandidates } from "../../_client/src/shared/utils/uri";
import { formatChainName, setActiveChainId } from "../../_client/src/config/chains.js";
import { getNftsForOwner, getProvenance } from "../../_client/src/data/nft/indexer";
import { buildBuilderTokenViewUrl } from "../../_client/src/config/links.js";
import {
  connectWallet,
  getWalletState,
  subscribeWallet,
} from "../../_client/src/features/wallet/wallet.js";
import { applyStoredPalette } from "../../_client/src/ui/palette-theme.js";

const FACE_ORDER = ["+Z", "-Z", "+X", "-X", "+Y", "-Y"];
const BUILDER_ABI = [
  "function getTokenRefs(uint256 tokenId) view returns (tuple(address contractAddress,uint256 tokenId)[])",
];

function truncateMiddle(value, start = 6, end = 4) {
  if (!value || value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function normalizeAddress(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function pickLabel(nft, fallback) {
  const raw = nft?.sourceMetadata?.raw;
  const label =
    raw?.collection?.name ||
    raw?.collection_name ||
    raw?.name ||
    raw?.title ||
    fallback;
  return typeof label === "string" && label.trim() ? label : fallback;
}

function buildFaces(nfts) {
  const list = Array.isArray(nfts) ? nfts.filter(Boolean) : [];
  if (!list.length) {
    return [];
  }
  return FACE_ORDER.map((faceId, index) => {
    const nft = list[index % list.length];
    const fallbackLabel = `Face ${faceId}`;
    const label = pickLabel(nft, fallbackLabel);
    const imageCandidates = nft?.image ? buildImageCandidates(nft.image) : [];
    return {
      faceId,
      title: label,
      collection: label,
      tokenId: String(nft?.tokenId || ""),
      contractAddress: nft?.contractAddress || "",
      media: {
        image: nft?.image?.resolved || nft?.image?.original || null,
        animation: null,
        imageCandidates,
        animationCandidates: [],
      },
    };
  });
}

function extractRefsFromMetadata(raw) {
  const candidates = [
    raw?.references,
    raw?.provenance?.refs,
    raw?.provenance?.refsFaces,
    raw?.provenance?.refsCanonical,
  ];
  const refs = candidates.find((value) => Array.isArray(value)) || [];
  return refs
    .map((ref) => ({
      contractAddress:
        ref?.contractAddress || ref?.contract || ref?.address || "",
      tokenId: ref?.tokenId != null ? String(ref.tokenId) : "",
    }))
    .filter((ref) => ref.contractAddress && ref.tokenId);
}

async function fetchRpcResults(chainId, calls) {
  const response = await fetch("/api/nfts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "rpc",
      chainId,
      calls,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`RPC call failed (${response.status}) ${detail}`);
  }
  return response.json();
}

async function fetchBuilderRefs(tokenId, chainId, contractAddress) {
  const iface = new Interface(BUILDER_ABI);
  const calls = [
    {
      to: contractAddress,
      data: iface.encodeFunctionData("getTokenRefs", [tokenId]),
    },
  ];
  const results = await fetchRpcResults(chainId, calls);
  if (!Array.isArray(results)) {
    return [];
  }
  const refsResult = results[0];
  if (!refsResult?.result) {
    return [];
  }
  try {
    const decoded = iface.decodeFunctionResult("getTokenRefs", refsResult.result);
    return decoded?.[0] || [];
  } catch (error) {
    return [];
  }
}

export default function BuilderViewerExtPage() {
  const [wallet, setWallet] = useState(() => getWalletState());
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("Connect wallet to view builder cubes.");

  const chainId = builderDeployment?.chainId || 1;
  const contractAddress = builderDeployment?.address || "";
  const chainLabel = formatChainName(chainId);
  const walletAddress = wallet?.address || "";
  const walletError = wallet?.error || "";
  const walletStatus = wallet?.status || "idle";

  useEffect(() => {
    applyStoredPalette();
  }, []);

  useEffect(() => {
    return subscribeWallet((next) => setWallet(next));
  }, []);

  useEffect(() => {
    if (!contractAddress) {
      setStatus("Builder contract not configured.");
      return;
    }
    if (!walletAddress) {
      setItems([]);
      setStatus(walletError || "Connect wallet to view builder cubes.");
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        setActiveChainId(chainId);
        setStatus(`Loading ${chainLabel} builder tokens...`);
        const nfts = await getNftsForOwner(walletAddress, chainId);
        const builderTokens = nfts.filter(
          (nft) =>
            normalizeAddress(nft.contractAddress) ===
            normalizeAddress(contractAddress)
        );
        if (!builderTokens.length) {
          if (mounted) {
            setItems([]);
            setStatus(`No ${chainLabel} builder tokens found for this wallet.`);
          }
          return;
        }
        const sorted = [...builderTokens].sort((a, b) => {
          try {
            const left = BigInt(a.tokenId);
            const right = BigInt(b.tokenId);
            return right > left ? 1 : right < left ? -1 : 0;
          } catch (error) {
            return 0;
          }
        });
        setStatus("Building cube grid...");
        const cubes = await Promise.all(
          sorted.map(async (token) => {
            const tokenId = String(token.tokenId);
            let refs = [];
            try {
              const metadata = await getProvenance(
                contractAddress,
                tokenId,
                chainId
              );
              refs = extractRefsFromMetadata(metadata?.sourceMetadata?.raw);
            } catch (error) {
              refs = [];
            }
            if (!refs.length) {
              refs = await fetchBuilderRefs(tokenId, chainId, contractAddress);
            }
            const refNfts = await Promise.all(
              refs.map(async (ref) => {
                try {
                  return await getProvenance(
                    ref.contractAddress,
                    String(ref.tokenId),
                    chainId
                  );
                } catch (error) {
                  return null;
                }
              })
            );
            const faces = buildFaces(refNfts);
            const linkUrl =
              buildBuilderTokenViewUrl(tokenId) || `/m2/${tokenId}`;
            return {
              id: tokenId,
              tokenId: truncateMiddle(tokenId),
              provenanceNFTs: faces,
              linkUrl,
            };
          })
        );
        if (!mounted) {
          return;
        }
        setItems(cubes);
        setStatus("");
      } catch (error) {
        if (!mounted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Failed to load tokens.";
        setStatus(message);
        setItems([]);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [walletAddress, walletError, chainId, chainLabel, contractAddress]);

  const connectLabel = walletStatus === "connecting" ? "Connecting" : "Connect";
  const connectDisabled = walletStatus === "connecting";

  const actions = useMemo(() => {
    if (!walletAddress) {
      return (
        <button
          type="button"
          className="paper-grid-button"
          onClick={() => connectWallet()}
          disabled={connectDisabled}
        >
          {connectLabel} wallet
        </button>
      );
    }
    return (
      <div className="paper-grid-wallet">
        <span className="paper-grid-wallet-label">Wallet</span>
        <span className="paper-grid-wallet-address">
          {truncateMiddle(walletAddress)}
        </span>
      </div>
    );
  }, [connectDisabled, connectLabel, walletAddress]);

  const subtitle = walletAddress
    ? `Builder cubes on ${chainLabel}`
    : `Connect to view builder cubes on ${chainLabel}`;

  return (
    <PaperCubeGrid
      title="cubixles_ token viewer ext"
      subtitle={subtitle}
      items={items}
      status={status}
      actions={actions}
    />
  );
}
