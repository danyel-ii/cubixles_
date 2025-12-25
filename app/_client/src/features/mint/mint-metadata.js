function floorKey(nft) {
  return `${nft.contractAddress}:${nft.tokenId}`;
}

function safeFloorValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

function buildReferenceSummary(selection) {
  return selection.map((nft) => {
    const raw = BigInt(nft.tokenId);
    const safe = raw <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(raw) : null;
    return {
      chainId: nft.chainId,
      contractAddress: nft.contractAddress,
      tokenId: nft.tokenId,
      tokenIdNumber: safe,
      image: nft.image,
      collectionFloorEth: safeFloorValue(nft.collectionFloorEth),
      collectionFloorRetrievedAt: nft.collectionFloorRetrievedAt ?? null,
    };
  });
}

function buildFloorSummary(selection) {
  const sumFloorEth = selection.reduce(
    (total, nft) => total + safeFloorValue(nft.collectionFloorEth),
    0
  );
  return { sumFloorEth };
}

function enrichProvenance(provenanceBundle, selection) {
  const byKey = new Map(
    selection.map((nft) => [
      floorKey(nft),
      {
        floorEth: safeFloorValue(nft.collectionFloorEth),
        retrievedAt: nft.collectionFloorRetrievedAt ?? null,
      },
    ])
  );
  const nfts = provenanceBundle.nfts.map((nft) => {
    const key = floorKey(nft);
    const snapshot = byKey.get(key);
    if (!snapshot) {
      return nft;
    }
    return {
      ...nft,
      collectionFloorEth: snapshot.floorEth,
      collectionFloorRetrievedAt: snapshot.retrievedAt,
    };
  });
  return {
    ...provenanceBundle,
    nfts,
    floorSummary: buildFloorSummary(selection),
  };
}

export function buildMintMetadata({
  tokenId,
  minter,
  chainId,
  selection,
  provenanceBundle,
  refsFaces,
  refsCanonical,
  animationUrl,
  imageUrl,
  gif,
}) {
  const provenance = enrichProvenance(provenanceBundle, selection);
  const refs = refsFaces ?? selection.map((nft) => ({
    contractAddress: nft.contractAddress,
    tokenId: nft.tokenId,
  }));
  const attributes = [
    { trait_type: "variantIndex", value: gif.variantIndex },
    { trait_type: "rgb_sep_px", value: gif.params.rgb_sep_px },
    { trait_type: "band_shift_px", value: gif.params.band_shift_px },
    { trait_type: "grain_intensity", value: gif.params.grain_intensity },
    { trait_type: "contrast_flicker", value: gif.params.contrast_flicker },
    { trait_type: "solarization_strength", value: gif.params.solarization_strength },
  ];

  return {
    schemaVersion: 1,
    name: tokenId ? `cubeLess #${tokenId}` : "cubeLess",
    description:
      "cubeLess mints interactive p5.js cubes whose provenance is tied to NFTs you already own.",
    image: imageUrl,
    animation_url: animationUrl,
    gif: {
      variantIndex: gif.variantIndex,
      selectionSeed: gif.selectionSeed,
      params: gif.params,
      lessSupplyMint: gif.lessSupplyMint,
    },
    provenance: {
      schemaVersion: 1,
      ...provenance,
      mintedBy: minter,
      chainId,
      refs,
      refsFaces: refsFaces ?? refs,
      refsCanonical: refsCanonical ?? refs,
    },
    attributes,
    references: buildReferenceSummary(selection),
    provenanceSummary: buildFloorSummary(selection),
  };
}
