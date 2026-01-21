import { getAddress } from "ethers";
import { alchemyGet } from "../chain/alchemy-client";
import { getActiveChainId, isSupportedChainId } from "../../config/chains.js";
import type {
  NftItem,
  ProvenanceBundle,
  ProvenanceNft,
} from "../../types/provenance";
import { resolveUri } from "../../shared/utils/uri";

type AlchemyNft = {
  contract?: { address?: string };
  tokenId?: string;
  tokenType?: string;
  name?: string | null;
  tokenUri?: { raw?: string } | string | null;
  collection?: { name?: string | null };
  image?: { cachedUrl?: string | null; originalUrl?: string | null } | null;
  metadata?: Record<string, unknown> | null;
  raw?: Record<string, unknown> | null;
};

type AlchemyGetNftsResponse = {
  ownedNfts?: AlchemyNft[];
  pageKey?: string;
};

type AlchemyMetadataResponse = AlchemyNft & {
  raw?: { metadata?: Record<string, unknown> | null } | Record<string, unknown>;
};

function assertConfiguredChain(chainId: number) {
  if (!isSupportedChainId(chainId)) {
    throw new Error("Unsupported chain for NFT indexer.");
  }
  if (chainId !== getActiveChainId()) {
    throw new Error(`Active chain is ${getActiveChainId()}.`);
  }
}

function parseTokenId(rawTokenId?: string): string {
  if (!rawTokenId) {
    throw new Error("Missing tokenId.");
  }
  return BigInt(rawTokenId).toString(10);
}

function normalizeAddress(address?: string): string {
  if (!address) {
    throw new Error("Missing contract address.");
  }
  return getAddress(address);
}

function extractTokenUri(nft: AlchemyNft): string | null {
  if (typeof nft.tokenUri === "string") {
    return nft.tokenUri;
  }
  return nft.tokenUri?.raw ?? null;
}

function extractImageUri(nft: AlchemyNft): string | null {
  if (nft.image?.originalUrl) {
    return nft.image.originalUrl;
  }
  if (nft.image?.cachedUrl) {
    return nft.image.cachedUrl;
  }
  const metadata =
    nft.metadata ?? (nft.raw as { metadata?: Record<string, unknown> })?.metadata;
  if (metadata && typeof (metadata as { image?: string }).image === "string") {
    return (metadata as { image?: string }).image ?? null;
  }
  if (
    metadata &&
    typeof (metadata as { image_data?: string }).image_data === "string"
  ) {
    const svg = (metadata as { image_data?: string }).image_data ?? "";
    const trimmed = svg.trim();
    if (!trimmed) {
      return null;
    }
    return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
  }
  return null;
}

function hasMetadata(nft: AlchemyNft): boolean {
  const tokenUri = extractTokenUri(nft);
  if (tokenUri) {
    return true;
  }
  const metadata =
    nft.metadata ?? (nft.raw as { metadata?: Record<string, unknown> })?.metadata;
  return Boolean(metadata && Object.keys(metadata).length > 0);
}

export {
  assertConfiguredChain,
  parseTokenId,
  normalizeAddress,
  extractTokenUri,
  extractImageUri,
  hasMetadata,
};

export async function getNftsForOwner(
  ownerAddress: string,
  chainId: number
): Promise<NftItem[]> {
  assertConfiguredChain(chainId);
  const items: NftItem[] = [];
  let pageKey: string | undefined;
  let pages = 0;
  const MAX_PAGES = 60;

  do {
    const response = await alchemyGet<AlchemyGetNftsResponse>(chainId, "getNFTsForOwner", {
      owner: ownerAddress,
      withMetadata: "true",
      excludeFilters: ["SPAM", "AIRDROP"],
      pageSize: 100,
      pageKey,
    });
    const owned = response.ownedNfts ?? [];
    owned.forEach((nft) => {
      try {
        const tokenType = nft.tokenType ?? null;
        const contractAddress = normalizeAddress(nft.contract?.address);
        const tokenId = parseTokenId(nft.tokenId);
        const tokenUri = resolveUri(extractTokenUri(nft));
        const image = resolveUri(extractImageUri(nft));
        const metadataAvailable = hasMetadata(nft);
        items.push({
          chainId,
          contractAddress,
          tokenId,
          name: nft.name ?? null,
          collectionName: nft.collection?.name ?? null,
          tokenUri,
          image,
          metadataAvailable,
          tokenType,
          source: "alchemy",
        } satisfies NftItem);
      } catch (error) {
        console.warn("Skipping NFT:", error);
      }
    });
    pageKey = response.pageKey;
    pages += 1;
  } while (pageKey && pages < MAX_PAGES);

  return items;
}

export async function getProvenance(
  contractAddress: string,
  tokenId: string,
  chainId: number
): Promise<ProvenanceNft> {
  assertConfiguredChain(chainId);
  const checksumAddress = normalizeAddress(contractAddress);
  const response = await alchemyGet<AlchemyMetadataResponse>(chainId, "getNFTMetadata", {
    contractAddress: checksumAddress,
    tokenId: tokenId,
    refreshCache: "false",
  });
  const tokenUri = resolveUri(extractTokenUri(response));
  const image = resolveUri(extractImageUri(response));
  const rawMetadata =
    (response.raw as { metadata?: Record<string, unknown> | null })?.metadata ??
    response.metadata ??
    null;

  return {
    chainId,
    contractAddress: checksumAddress,
    tokenId,
    tokenUri,
    image,
    sourceMetadata: { raw: rawMetadata },
    retrievedVia: "alchemy",
    retrievedAt: new Date().toISOString(),
  };
}

export async function buildProvenanceBundle(
  selected: NftItem[],
  selectedByAddress: string,
  chainId: number
): Promise<ProvenanceBundle> {
  assertConfiguredChain(chainId);
  if (selected.length < 1 || selected.length > 6) {
    throw new Error("Provenance bundle requires 1 to 6 NFTs.");
  }
  const selectedBy = getAddress(selectedByAddress);
  const provenanceList = await Promise.all(
    selected.map((nft) => getProvenance(nft.contractAddress, nft.tokenId, chainId))
  );
  return {
    chainId,
    selectedBy,
    retrievedAt: new Date().toISOString(),
    nfts: provenanceList,
  };
}
