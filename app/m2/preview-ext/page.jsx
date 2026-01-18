"use client";

import { useEffect, useState } from "react";

import PaperCubeGrid from "../../_components/PaperCubeGrid.jsx";
import { buildImageCandidates } from "../../_client/src/shared/utils/uri";
import { formatChainName, getActiveChainId } from "../../_client/src/config/chains.js";
import { applyStoredPalette } from "../../_client/src/ui/palette-theme.js";

const PREVIEW_STORAGE_KEY = "cubixles:m2-preview";
const FACE_ORDER = ["+Z", "-Z", "+X", "-X", "+Y", "-Y"];

function truncateMiddle(value, start = 6, end = 4) {
  if (!value || value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function buildFaces(entries) {
  if (!entries.length) {
    return [];
  }
  return FACE_ORDER.map((faceId, index) => {
    const entry = entries[index % entries.length] || {};
    const label = entry.collectionName || entry.name || `Face ${faceId}`;
    const imageSource = entry.image || null;
    const imageCandidates = imageSource ? buildImageCandidates(imageSource) : [];
    const resolvedImage =
      imageSource?.resolved || imageSource?.original || imageSource || null;
    return {
      faceId,
      title: label,
      collection: label,
      tokenId: String(entry.tokenId || ""),
      contractAddress: entry.contractAddress,
      media: {
        image: resolvedImage,
        animation: null,
        imageCandidates,
        animationCandidates: [],
      },
    };
  });
}

export default function PreviewExtPage() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("Loading preview...");
  const [subtitle, setSubtitle] = useState("");

  useEffect(() => {
    applyStoredPalette();
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) {
      setStatus("No preview data found. Return to the mint screen.");
      return;
    }
    try {
      const data = JSON.parse(raw);
      const entries = Array.isArray(data?.faces) ? data.faces : [];
      if (!entries.length) {
        setStatus("Preview has no faces. Select NFTs first.");
        return;
      }
      const faces = buildFaces(entries);
      const tokenId = String(data?.tokenId || "preview");
      const network = data?.network || formatChainName(getActiveChainId());
      setItems([
        {
          id: tokenId,
          tokenId: truncateMiddle(tokenId),
          provenanceNFTs: faces,
        },
      ]);
      setSubtitle(`Builder preview on ${network}`);
      setStatus("");
    } catch (error) {
      setStatus("Preview data is invalid. Refresh from the mint screen.");
    }
  }, []);

  const title = "cubixles_ preview ext";
  const gridSubtitle = subtitle || "Preview grid for builder cube.";

  return (
    <PaperCubeGrid
      title={title}
      subtitle={gridSubtitle}
      items={items}
      status={status}
    />
  );
}
