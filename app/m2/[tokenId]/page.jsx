"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Interface } from "ethers";

import PaperTokenViewer from "../../_components/PaperTokenViewer.jsx";
import builderDeployment from "../../../contracts/deployments/builder-mainnet.json";
import { buildImageCandidates } from "../../_client/src/shared/utils/uri";
import { formatChainName, setActiveChainId } from "../../_client/src/config/chains.js";
import { getProvenance } from "../../_client/src/data/nft/indexer";
import { getCollectionFloorSnapshot } from "../../_client/src/data/nft/floor.js";
import { applyStoredPalette } from "../../_client/src/ui/palette-theme.js";

const FACE_ORDER = ["+Z", "-Z", "+X", "-X", "+Y", "-Y"];
const DEFAULT_DESCRIPTION =
  "cubixles_ token viewer 02, rendered on collegiate paper stock.";
const BUILDER_ABI = [
  "function getTokenRefs(uint256 tokenId) view returns (tuple(address contractAddress,uint256 tokenId)[])",
  "function ownerOf(uint256 tokenId) view returns (address)",
];

function truncateMiddle(value, start = 6, end = 4) {
  if (!value) {
    return "";
  }
  if (value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatAddress(value) {
  if (!value) {
    return "n/a";
  }
  if (value.startsWith("0x") && value.length > 12) {
    return truncateMiddle(value);
  }
  return value;
}

function formatMintedAt(value) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
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

function buildFaces(nfts, floorMap) {
  if (!nfts.length) {
    return [];
  }
  return FACE_ORDER.map((faceId, index) => {
    const nft = nfts[index % nfts.length];
    const fallbackLabel = `Face ${faceId}`;
    const label = pickLabel(nft, fallbackLabel);
    const imageCandidates = nft?.image ? buildImageCandidates(nft.image) : [];
    const contractKey = nft?.contractAddress ? nft.contractAddress.toLowerCase() : null;
    const snapshot = contractKey ? floorMap.get(contractKey) : null;
    return {
      faceId,
      title: label,
      collection: label,
      tokenId: String(nft?.tokenId || ""),
      contractAddress: nft?.contractAddress,
      floorEth: snapshot?.floorEth ?? null,
      floorRetrievedAt: snapshot?.retrievedAt ?? null,
      ownerNote: "",
      description: "",
      explorerUrl: "",
      media: {
        image: nft?.image?.resolved || nft?.image?.original || null,
        animation: null,
        imageCandidates,
        animationCandidates: [],
      },
    };
  });
}

async function loadFloorMap(refs, chainId) {
  const map = new Map();
  await Promise.all(
    refs.map(async (ref) => {
      const contract = ref?.contractAddress;
      if (!contract) {
        return;
      }
      const key = contract.toLowerCase();
      if (map.has(key)) {
        return;
      }
      const snapshot = await getCollectionFloorSnapshot(contract, chainId);
      map.set(key, snapshot);
    })
  );
  return map;
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

async function fetchBuilderRefsAndOwner(tokenId, chainId, contractAddress) {
  const iface = new Interface(BUILDER_ABI);
  const calls = [
    {
      to: contractAddress,
      data: iface.encodeFunctionData("getTokenRefs", [tokenId]),
    },
    {
      to: contractAddress,
      data: iface.encodeFunctionData("ownerOf", [tokenId]),
    },
  ];
  const results = await fetchRpcResults(chainId, calls);
  if (!Array.isArray(results)) {
    throw new Error("Unexpected RPC response.");
  }
  const refsResult = results[0];
  if (!refsResult?.result) {
    throw new Error("Token refs unavailable.");
  }
  const refsDecoded = iface.decodeFunctionResult("getTokenRefs", refsResult.result);
  const refs = refsDecoded?.[0] || [];
  const ownerResult = results[1];
  let owner = null;
  if (ownerResult?.result) {
    const ownerDecoded = iface.decodeFunctionResult("ownerOf", ownerResult.result);
    owner = ownerDecoded?.[0] || null;
  }
  return { refs, owner };
}

export default function BuilderTokenViewerPage() {
  const params = useParams();
  const tokenId = params?.tokenId ? String(params.tokenId) : "";
  const [cube, setCube] = useState(null);
  const [status, setStatus] = useState("Loading token...");
  const [palette, setPalette] = useState(null);

  useEffect(() => {
    const storedPalette = applyStoredPalette();
    if (storedPalette) {
      setPalette(storedPalette);
    }
  }, []);

  useEffect(() => {
    if (!tokenId) {
      setStatus("Missing token id.");
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const chainId = builderDeployment.chainId || 1;
        const contractAddress = builderDeployment.address;
        if (!contractAddress) {
          throw new Error("Builder contract not configured.");
        }
        setActiveChainId(chainId);
        setStatus("Loading builder refs...");
        const { refs, owner } = await fetchBuilderRefsAndOwner(
          tokenId,
          chainId,
          contractAddress
        );
        if (!refs.length) {
          throw new Error("No references found for this token.");
        }
        setStatus("Loading collection floors...");
        const floorMap = await loadFloorMap(refs, chainId);
        setStatus("Loading referenced NFTs...");
        const nfts = await Promise.all(
          refs.map((ref) =>
            getProvenance(ref.contractAddress, String(ref.tokenId), chainId)
          )
        );
        const faces = buildFaces(nfts, floorMap);
        if (!faces.length) {
          throw new Error("Missing reference images.");
        }
        if (!mounted) {
          return;
        }
        setCube({
          tokenId,
          description: DEFAULT_DESCRIPTION,
          mintedAt: formatMintedAt(null),
          mintedBy: formatAddress(owner),
          network: formatChainName(chainId),
          provenanceNFTs: faces,
        });
      } catch (error) {
        if (!mounted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to load token.";
        setStatus(message);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [tokenId]);

  const content = useMemo(() => {
    if (cube) {
      return (
        <PaperTokenViewer
          cube={cube}
          requestedTokenId={tokenId}
          palette={palette}
        />
      );
    }
    return (
      <div className="token-view-status">
        {status}
      </div>
    );
  }, [cube, palette, status, tokenId]);

  return content;
}
