import { buildBuilderTokenViewUrl } from "../../config/links.js";

function safeText(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

const MAX_LINKED_METADATA_BYTES = 3500;
const MAX_LINKED_TEXT = 280;
const MAX_LINKED_URL = 512;
const MAX_LINKED_ATTRIBUTES = 12;

function trimString(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength);
}

function sanitizeUrl(value) {
  const trimmed = trimString(value, MAX_LINKED_URL);
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("data:")) {
    return null;
  }
  return trimmed;
}

function sanitizeAttribute(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const trait = trimString(entry.trait_type || entry.traitType || "", 64);
  let value = entry.value;
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    value = trimString(value, 160);
  } else if (typeof value === "number" || typeof value === "boolean") {
    value = value;
  } else {
    value = trimString(String(value), 160);
  }
  if (value == null) {
    return null;
  }
  const displayType = trimString(entry.display_type || entry.displayType || "", 32);
  const next = {
    trait_type: trait || "Trait",
    value,
  };
  if (displayType) {
    next.display_type = displayType;
  }
  return next;
}

function sanitizeLinkedMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const safe = {
    name: trimString(metadata.name, MAX_LINKED_TEXT) || undefined,
    description: trimString(metadata.description, MAX_LINKED_TEXT) || undefined,
    image: sanitizeUrl(metadata.image) || undefined,
    image_url: sanitizeUrl(metadata.image_url) || undefined,
    animation_url: sanitizeUrl(metadata.animation_url) || undefined,
    external_url: sanitizeUrl(metadata.external_url) || undefined,
  };
  if (Array.isArray(metadata.attributes)) {
    const attrs = metadata.attributes
      .map((entry) => sanitizeAttribute(entry))
      .filter(Boolean)
      .slice(0, MAX_LINKED_ATTRIBUTES);
    if (attrs.length) {
      safe.attributes = attrs;
    }
  }
  const size = JSON.stringify(safe).length;
  if (size <= MAX_LINKED_METADATA_BYTES) {
    return safe;
  }
  if (safe.attributes) {
    delete safe.attributes;
  }
  const trimmedSize = JSON.stringify(safe).length;
  if (trimmedSize <= MAX_LINKED_METADATA_BYTES) {
    return safe;
  }
  return null;
}

function buildRefs(selection) {
  return selection.map((nft) => ({
    contractAddress: nft.contractAddress,
    tokenId: nft.tokenId,
  }));
}

function buildFloorSnapshots(selection, floorsWei, floorsEth) {
  const floorsWeiList = Array.isArray(floorsWei) ? floorsWei : [];
  const floorsEthList = Array.isArray(floorsEth) ? floorsEth : [];
  return selection.map((nft, index) => ({
    contract_address: nft.contractAddress,
    token_id: nft.tokenId,
    name: safeText(nft.name, "Unknown"),
    collection: safeText(nft.collectionName, "Unknown"),
    floor_wei: floorsWeiList[index] ?? "0",
    floor_eth: floorsEthList[index] ?? "0.0000",
  }));
}

function formatPaperclipSpec(spec, qrText) {
  if (!spec || typeof spec !== "object") {
    return null;
  }
  const layers = Array.isArray(spec.layers) ? spec.layers : [];
  return {
    seed: spec.seed,
    size: spec.size,
    scale: spec.scale,
    palette_hex: Array.isArray(spec.paletteHex) ? spec.paletteHex : [],
    qr_text: typeof qrText === "string" && qrText.trim() ? qrText : undefined,
    layers: layers.map((layer, index) => ({
      index: Number.isFinite(layer.index) ? layer.index : index,
      layer_seed: layer.layerSeed,
      color: layer.color,
      grid: layer.grid,
      hole_probability: layer.holeProbability,
      radius_factor: layer.radiusFactor,
      square_mix: layer.squareMix,
      rotation: layer.rotation,
      scale: layer.scale,
      offset_x: layer.offsetX,
      offset_y: layer.offsetY,
      shadow_blur: layer.shadowBlur,
      shadow_offset_y: layer.shadowOffsetY,
    })),
  };
}

function buildLinkedNftMetadata(selection, selectedNftMetadata) {
  const metadataList = Array.isArray(selectedNftMetadata) ? selectedNftMetadata : [];
  const metadataByKey = new Map(
    metadataList
      .filter((entry) => entry?.contractAddress && entry?.tokenId != null)
      .map((entry) => [`${entry.contractAddress}:${entry.tokenId}`, entry])
  );
  return selection.map((nft, index) => {
    const key = `${nft.contractAddress}:${nft.tokenId}`;
    const entry = metadataByKey.get(key) ?? metadataList[index] ?? null;
    return {
      index: index + 1,
      contract_address: nft.contractAddress,
      token_id: nft.tokenId,
      name: safeText(nft.name, "Unknown"),
      collection: safeText(nft.collectionName, "Unknown"),
      token_uri:
        entry?.tokenUri ||
        nft?.tokenUri?.original ||
        nft?.tokenUri?.resolved ||
        null,
      metadata: sanitizeLinkedMetadata(entry?.metadata),
    };
  });
}

function buildSelectionAttributes(selection, floorsEth) {
  return selection.map((nft, index) => {
    const name = safeText(nft.collectionName || nft.name, "Unknown");
    const floor = floorsEth?.[index] ?? "0.0000";
    return {
      trait_type: `Selected NFT ${index + 1}`,
      value: `${name} #${nft.tokenId} (${floor} ETH)`,
    };
  });
}

export function buildBuilderMetadata({
  tokenId,
  minter,
  chainId,
  selection,
  floorsWei,
  floorsEth,
  totalFloorWei,
  totalFloorEth,
  mintPriceWei,
  mintPriceEth,
  imageUrl,
  animationUrl,
  externalUrl,
  qrImage,
  paperclipImage,
  paperclipSpec,
  paperclipQrText,
  selectedNftMetadata,
}) {
  const refs = buildRefs(selection);
  const floorSnapshots = buildFloorSnapshots(selection, floorsWei, floorsEth);
  const paperclip = formatPaperclipSpec(paperclipSpec, paperclipQrText);
  const linkedNfts = buildLinkedNftMetadata(selection, selectedNftMetadata);
  const feingehalt = {
    eth: mintPriceEth ?? "0.0000",
    wei: mintPriceWei ?? "0",
  };
  const viewerUrl = tokenId ? buildBuilderTokenViewUrl(tokenId) : "";
  const resolvedViewerUrl = viewerUrl || externalUrl || "";
  const descriptionLines = [
    "cubixles_ builder mint: an ERC-721 composed from your NFT references.",
  ];
  if (resolvedViewerUrl) {
    descriptionLines.push(`Token viewer: ${resolvedViewerUrl}`);
  }
  const attributes = [
    { trait_type: "Feingehalt (ETH)", value: mintPriceEth ?? "0.0000" },
    { trait_type: "Feingehalt (Wei)", value: mintPriceWei ?? "0" },
    { trait_type: "Total Floor Snapshot (ETH)", value: totalFloorEth ?? "0.0000" },
    { trait_type: "Total Floor Snapshot (Wei)", value: totalFloorWei ?? "0" },
    { trait_type: "Selection Count", value: selection.length },
    ...buildSelectionAttributes(selection, floorsEth),
  ];

  return {
    schemaVersion: 1,
    name: tokenId ? `cubixles_ builder #${tokenId}` : "cubixles_ builder",
    tokenId,
    issuer: minter,
    description: descriptionLines.join("\n"),
    image: imageUrl || undefined,
    image_url: imageUrl || undefined,
    image_ipfs:
      imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("ipfs://")
        ? imageUrl
        : undefined,
    animation_url: animationUrl || undefined,
    external_url: resolvedViewerUrl || undefined,
    builder: {
      mintPriceWei,
      mintPriceEth,
      totalFloorWei,
      totalFloorEth,
      floorsWei: floorsWei || [],
      floorsEth: floorsEth || [],
      feingehalt,
      floorPricesAtMint: floorSnapshots,
      qrImage: qrImage || undefined,
      paperclipImage: paperclipImage || undefined,
    },
    feingehalt,
    floor_prices_at_mint: floorSnapshots,
    paperclip: paperclip || undefined,
    linked_nfts: linkedNfts,
    provenance: {
      mintedBy: minter,
      chainId,
      tokenId,
      refs,
      refsFaces: refs,
      refsCanonical: refs,
    },
    attributes,
    references: refs,
  };
}
