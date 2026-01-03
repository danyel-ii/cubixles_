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

function buildSelectionSummary(selection) {
  return selection
    .map((nft) => {
      const name = nft.collectionName || nft.name || "Unknown";
      return `${name} #${nft.tokenId}`;
    })
    .join(" | ");
}

function buildSelectionAttributes(selection) {
  return selection.map((nft, index) => {
    const name = nft.collectionName || nft.name || "Unknown";
    const contract = nft.contractAddress
      ? `${nft.contractAddress.slice(0, 6)}…${nft.contractAddress.slice(-4)}`
      : "unknown";
    return {
      trait_type: `Selected NFT ${index + 1}`,
      value: `${name} #${nft.tokenId} (${contract})`,
    };
  });
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

function sanitizeProvenance(provenance) {
  if (!provenance?.nfts) {
    return provenance;
  }
  return {
    ...provenance,
    nfts: provenance.nfts.map(({ sourceMetadata, ...rest }) => rest),
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
  salt,
  animationUrl,
  imageUrl,
  lessSupplyMint,
}) {
  const provenance = sanitizeProvenance(
    enrichProvenance(provenanceBundle, selection)
  );
  const refs = refsFaces ?? selection.map((nft) => ({
    contractAddress: nft.contractAddress,
    tokenId: nft.tokenId,
  }));
  const attributes = [
    {
      trait_type: "Total Floor Snapshot (ETH)",
      value: Number(buildFloorSummary(selection).sumFloorEth.toFixed(6)),
    },
    { trait_type: "LESS Supply At Mint", value: lessSupplyMint },
    { trait_type: "Selection Count", value: selection.length },
    { trait_type: "Selected NFTs", value: buildSelectionSummary(selection) || "None" },
    { trait_type: "Animation URL", value: animationUrl, display_type: "url" },
    ...buildSelectionAttributes(selection),
  ];

  return {
    schemaVersion: 1,
    name: tokenId ? `cubixles_ #${tokenId}` : "cubixles_",
    tokenId,
    description: [
      "cubixles_ mints interactive p5.js cubes whose provenance is tied to NFTs you already own.",
      "Interactive cube:",
      animationUrl,
    ].join("\n"),
    image: imageUrl,
    external_url: animationUrl,
    animation_url: animationUrl,
    provenance: {
      schemaVersion: 1,
      ...provenance,
      mintedBy: minter,
      chainId,
      tokenId,
      salt,
      refs,
      refsFaces: refsFaces ?? refs,
      refsCanonical: refsCanonical ?? refs,
    },
    attributes,
    references: buildReferenceSummary(selection),
    provenanceSummary: buildFloorSummary(selection),
  };
}
