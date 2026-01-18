function safeText(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function buildRefs(selection) {
  return selection.map((nft) => ({
    contractAddress: nft.contractAddress,
    tokenId: nft.tokenId,
  }));
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
}) {
  const refs = buildRefs(selection);
  const descriptionLines = [
    "cubixles_ builder mint: an ERC-721 composed from your NFT references.",
  ];
  if (externalUrl) {
    descriptionLines.push(`Token viewer: ${externalUrl}`);
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
    description: descriptionLines.join("\n"),
    image: imageUrl || undefined,
    image_url: imageUrl || undefined,
    animation_url: animationUrl || undefined,
    external_url: externalUrl || undefined,
    builder: {
      mintPriceWei,
      mintPriceEth,
      totalFloorWei,
      totalFloorEth,
      floorsWei: floorsWei || [],
      floorsEth: floorsEth || [],
    },
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
