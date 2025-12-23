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
    };
  });
}

export function buildMintMetadata(selection, provenanceBundle) {
  const primaryImage = selection[0]?.image?.resolved ?? null;
  const thumbnail = getMintThumbnailUrl() ?? primaryImage;

  return {
    schemaVersion: 1,
    name: "cubeless",
    description: "cubeless mint gated by 1 to 6 NFTs.",
    image: thumbnail,
    animation_url: getMintAnimationUrl(),
    provenance: provenanceBundle,
    references: buildReferenceSummary(selection),
  };
}
