function readEnvValue(key) {
  const raw = import.meta?.env?.[key];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function getMintAnimationUrl() {
  return readEnvValue("VITE_APP_ANIMATION_URL");
}

export function getMintThumbnailUrl() {
  return readEnvValue("VITE_MINT_THUMBNAIL_URL");
}

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

export function buildMintMetadata(selection, provenanceBundle) {
  const primaryImage = selection[0]?.image?.resolved ?? null;
  const thumbnail = getMintThumbnailUrl() ?? primaryImage;
  const provenance = enrichProvenance(provenanceBundle, selection);

  return {
    schemaVersion: 1,
    name: "cubeless",
    description: "cubeless mint gated by 1 to 6 NFTs.",
    image: thumbnail,
    animation_url: getMintAnimationUrl(),
    provenance,
    references: buildReferenceSummary(selection),
    provenanceSummary: buildFloorSummary(selection),
  };
}
