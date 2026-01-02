import { getAddress } from "ethers";
import { alchemyGet } from "../chain/alchemy-client";
import { CUBIXLES_CONTRACT } from "../../config/contracts";
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

function assertMainnet(chainId: number) {
  if (chainId !== CUBIXLES_CONTRACT.chainId) {
    throw new Error(`Configured for chain ${CUBIXLES_CONTRACT.chainId}.`);
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

export {
  assertMainnet,
  parseTokenId,
  normalizeAddress,
  extractTokenUri,
  extractImageUri,
};

export async function getNftsForOwner(
  ownerAddress: string,
  chainId: number
): Promise<NftItem[]> {
  assertMainnet(chainId);
  const items: NftItem[] = [];
  let pageKey: string | undefined;
  let pages = 0;
  const MAX_PAGES = 20;

  do {
    const response = await alchemyGet<AlchemyGetNftsResponse>(chainId, "getNFTsForOwner", {
      owner: ownerAddress,
      withMetadata: "true",
      pageKey,
    });
    const owned = response.ownedNfts ?? [];
    owned.forEach((nft) => {
      try {
        if (nft.tokenType && nft.tokenType !== "ERC721") {
          throw new Error("Unsupported token standard.");
        }
        const contractAddress = normalizeAddress(nft.contract?.address);
        const tokenId = parseTokenId(nft.tokenId);
        const tokenUri = resolveUri(extractTokenUri(nft));
        const image = resolveUri(extractImageUri(nft));
        items.push({
          chainId,
          contractAddress,
          tokenId,
          name: nft.name ?? null,
          collectionName: nft.collection?.name ?? null,
          tokenUri,
          image,
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
  assertMainnet(chainId);
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
  assertMainnet(chainId);
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
