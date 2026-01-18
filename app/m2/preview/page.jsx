"use client";

import { useEffect, useMemo, useState } from "react";

import PaperTokenViewer from "../../_components/PaperTokenViewer.jsx";
import { buildImageCandidates } from "../../_client/src/shared/utils/uri";
import { formatChainName, getActiveChainId } from "../../_client/src/config/chains.js";
import { getCollectionFloorSnapshot } from "../../_client/src/data/nft/floor.js";
import { applyStoredPalette } from "../../_client/src/ui/palette-theme.js";

const PREVIEW_STORAGE_KEY = "cubixles:m2-preview";
const FACE_ORDER = ["+Z", "-Z", "+X", "-X", "+Y", "-Y"];
const DEFAULT_DESCRIPTION =
  "cubixles_ token viewer 02 preview, rendered on collegiate paper stock.";
const MIN_FLOOR_ETH = 0.001;

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

function buildFaces(entries, floorMap) {
  if (!entries.length) {
    return [];
  }
  return FACE_ORDER.map((faceId, index) => {
    const entry = entries[index % entries.length] || {};
    const label = entry.collectionName || entry.name || `Face ${faceId}`;
    const imageSource = entry.image || null;
    const imageCandidates = imageSource ? buildImageCandidates(imageSource) : [];
    const contractKey = entry.contractAddress
      ? entry.contractAddress.toLowerCase()
      : null;
    const snapshot = contractKey ? floorMap.get(contractKey) : null;
    return {
      faceId,
      title: label,
      collection: label,
      tokenId: String(entry.tokenId || ""),
      contractAddress: entry.contractAddress,
      floorEth: snapshot?.floorEth ?? null,
      floorRetrievedAt: snapshot?.retrievedAt ?? null,
      ownerNote: "",
      description: "",
      explorerUrl: "",
      media: {
        image: imageSource,
        animation: null,
        imageCandidates,
        animationCandidates: [],
      },
    };
  });
}

async function loadFloorMap(entries, chainId) {
  const map = new Map();
  await Promise.all(
    entries.map(async (entry) => {
      const contract = entry?.contractAddress;
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

function buildPricingSummary(entries, floorMap) {
  const floors = entries.map((entry) => {
    const contractKey = entry.contractAddress
      ? entry.contractAddress.toLowerCase()
      : null;
    const snapshot = contractKey ? floorMap.get(contractKey) : null;
    return typeof snapshot?.floorEth === "number" ? snapshot.floorEth : 0;
  });
  const currentSum = floors.reduce((sum, floor) => sum + floor, 0);
  const paddedCount = Math.max(0, 6 - entries.length);
  const totalFloor = floors.reduce(
    (sum, floor) => sum + (floor > 0 ? floor : MIN_FLOOR_ETH),
    0
  );
  const mintPrice = (totalFloor + paddedCount * MIN_FLOOR_ETH) * 0.1;
  return { currentSum, mintPrice };
}

export default function PreviewTokenViewerPage() {
  const [cube, setCube] = useState(null);
  const [status, setStatus] = useState("Loading preview...");
  const [palette, setPalette] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedPalette = applyStoredPalette();
    if (storedPalette) {
      setPalette(storedPalette);
    }
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) {
      setStatus("No preview data found. Return to the mint screen.");
      return;
    }
    let mounted = true;
    const load = async () => {
      try {
        const data = JSON.parse(raw);
        const entries = Array.isArray(data?.faces) ? data.faces : [];
        const chainId = getActiveChainId();
        const floorMap = await loadFloorMap(entries, chainId);
        const faces = buildFaces(entries, floorMap);
        const pricing = buildPricingSummary(entries, floorMap);
        if (!faces.length) {
          setStatus("Preview has no faces. Select NFTs first.");
          return;
        }
        const tokenId = String(data?.tokenId || "preview");
        if (!mounted) {
          return;
        }
        setCube({
          tokenId,
          description: data?.description || DEFAULT_DESCRIPTION,
          mintedAt: formatMintedAt(data?.mintedAt),
          mintedBy: data?.mintedBy || "",
          network: data?.network || formatChainName(chainId),
          mintPriceEth: pricing.mintPrice,
          currentFloorSumEth: pricing.currentSum,
          provenanceNFTs: faces,
        });
      } catch (error) {
        if (mounted) {
          setStatus("Preview data is invalid. Refresh from the mint screen.");
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const content = useMemo(() => {
    if (cube) {
      return (
        <PaperTokenViewer
          cube={cube}
          requestedTokenId={cube.tokenId}
          palette={palette}
        />
      );
    }
    return (
      <div className="token-view-status">
        {status}
      </div>
    );
  }, [cube, palette, status]);

  return content;
}
