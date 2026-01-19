import { getCachedJson } from "./cache";
import { getAlchemyNftBaseUrl, getEnvConfig } from "./env";
import { normalizeAddress, normalizeTokenId } from "./normalize";

type AlchemyNftMedia = {
  gateway?: string;
  raw?: string;
  thumbnail?: string;
  format?: string;
};

type AlchemyMintInfo = {
  transactionHash?: string;
  minterAddress?: string;
  blockNumber?: number;
  timestamp?: string;
};

type AlchemyNft = {
  contract?: { address?: string };
  tokenId?: string;
  title?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  raw?: {
    metadata?: Record<string, unknown>;
    tokenUri?: string;
  };
  tokenUri?: {
    raw?: string;
    gateway?: string;
  } | string;
  media?: AlchemyNftMedia[];
  mint?: AlchemyMintInfo;
};

type AlchemyCollectionResponse = {
  nfts?: AlchemyNft[];
  pageKey?: string;
};

type AlchemyMetadataResponse = AlchemyNft & {
  contract?: { address?: string };
};

type AlchemyOwnersResponse = {
  owners?: string[];
};

export type NormalizedNft = {
  tokenId: string;
  title?: string;
  name?: string;
  description?: string;
  metadata: Record<string, unknown> | null;
  tokenUri: {
    raw?: string;
    gateway?: string;
  } | null;
  media: AlchemyNftMedia[];
  mint: AlchemyMintInfo | null;
};

export type NormalizedTokenMetadata = {
  tokenId: string;
  contractAddress: string;
  title?: string;
  name?: string;
  description?: string;
  metadata: Record<string, unknown> | null;
  tokenUri: {
    raw?: string;
    gateway?: string;
  } | null;
  media: AlchemyNftMedia[];
  mint: AlchemyMintInfo | null;
};

export type NormalizedCollectionPage = {
  contractAddress: string;
  tokens: NormalizedNft[];
  pageKey?: string;
};

export type NormalizedCollectionAggregate = {
  contractAddress: string;
  tokens: NormalizedNft[];
  pageKey: string | null;
  pages: number;
  truncated: boolean;
};

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function pickString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTokenUri(
  value: unknown
): { raw?: string; gateway?: string } | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const raw = pickString(value);
    return raw ? { raw } : null;
  }
  if (typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const raw = pickString(record.raw);
  const gateway = pickString(record.gateway);
  if (!raw && !gateway) {
    return null;
  }
  return { raw, gateway };
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeMintInfo(value: unknown): AlchemyMintInfo | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  return {
    transactionHash:
      pickString(record.transactionHash) ?? pickString(record.transaction_hash),
    minterAddress:
      pickString(record.minterAddress) ??
      pickString(record.mintAddress) ??
      pickString(record.mint_address),
    blockNumber: parseNumber(record.blockNumber),
    timestamp: pickString(record.timestamp),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, attempts = 3) {
  let attempt = 0;

  while (attempt <= attempts) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }

      if (!RETRYABLE_STATUSES.has(response.status) || attempt === attempts) {
        return response;
      }
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
    }

    const delay = 250 * Math.pow(2, attempt);
    await sleep(delay);
    attempt += 1;
  }

  throw new Error("Retry attempts exhausted");
}

async function alchemyFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  chainIdOverride?: number
): Promise<T> {
  const baseUrl = getAlchemyNftBaseUrl(chainIdOverride);
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    url.searchParams.set(key, String(value));
  });

  const response = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Alchemy request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export async function getNftsForCollection(
  limit: number,
  pageKey?: string | null,
  chainIdOverride?: number
): Promise<NormalizedCollectionPage> {
  const { contractAddress, cacheTtls } = getEnvConfig(chainIdOverride);
  const normalizedContract = normalizeAddress(contractAddress);
  if (!normalizedContract) {
    throw new Error("Invalid CUBIXLES_CONTRACT value");
  }

  const clampedLimit = Math.min(Math.max(limit, 1), 100);
  const cacheKey = `alchemy:collection:${normalizedContract}:${clampedLimit}:${
    pageKey ? encodeURIComponent(pageKey) : "first"
  }`;

  return getCachedJson(cacheKey, cacheTtls.tokens, async () => {
    const response = await alchemyFetch<AlchemyCollectionResponse>(
      "/getNFTsForCollection",
      {
        contractAddress: normalizedContract,
        withMetadata: true,
        limit: clampedLimit,
        pageKey: pageKey ?? undefined,
      },
      chainIdOverride
    );

    const tokens = (response.nfts ?? [])
      .filter((nft) => {
        const nftAddress = normalizeAddress(nft.contract?.address);
        return nftAddress === normalizedContract;
      })
      .map<NormalizedNft | null>((nft) => {
        const tokenId = normalizeTokenId(nft.tokenId);
        if (!tokenId) {
          return null;
        }

        return {
          tokenId,
          title: nft.title,
          name: nft.name,
          description: nft.description,
          metadata: nft.metadata ?? nft.raw?.metadata ?? null,
          tokenUri: normalizeTokenUri(nft.tokenUri ?? nft.raw?.tokenUri),
          media: nft.media ?? [],
          mint: normalizeMintInfo(nft.mint),
        };
      })
      .filter((token): token is NormalizedNft => Boolean(token));

    return {
      contractAddress: normalizedContract,
      tokens,
      pageKey: response.pageKey,
    };
  });
}

export async function getAllNftsForCollection(options?: {
  pageSize?: number;
  maxPages?: number;
  startPageKey?: string | null;
  chainId?: number;
}): Promise<NormalizedCollectionAggregate> {
  const chainId = options?.chainId;
  const { contractAddress, cacheTtls } = getEnvConfig(chainId);
  const normalizedContract = normalizeAddress(contractAddress);
  if (!normalizedContract) {
    throw new Error("Invalid CUBIXLES_CONTRACT value");
  }

  const pageSize = Math.min(Math.max(options?.pageSize ?? 100, 1), 100);
  const maxPages = Math.min(Math.max(options?.maxPages ?? 10, 1), 50);
  const startKey = options?.startPageKey ?? null;
  const cacheKey = `alchemy:collection:all:${normalizedContract}:${pageSize}:${maxPages}:${
    startKey ? encodeURIComponent(startKey) : "start"
  }`;

  return getCachedJson(cacheKey, cacheTtls.tokens, async () => {
    const tokensById = new Map<string, NormalizedNft>();
    const seenPageKeys = new Set<string>();
    let pageKey = startKey ?? undefined;
    let pages = 0;
    let truncated = false;

    while (pages < maxPages) {
      if (pageKey) {
        if (seenPageKeys.has(pageKey)) {
          truncated = true;
          break;
        }
        seenPageKeys.add(pageKey);
      }

      const page = await getNftsForCollection(pageSize, pageKey, chainId);
      page.tokens.forEach((token) => {
        tokensById.set(token.tokenId, token);
      });

      pages += 1;
      if (!page.pageKey || page.tokens.length === 0) {
        pageKey = null;
        break;
      }
      pageKey = page.pageKey;
    }

    if (pageKey) {
      truncated = true;
    }

    return {
      contractAddress: normalizedContract,
      tokens: Array.from(tokensById.values()),
      pageKey: pageKey ?? null,
      pages,
      truncated,
    };
  });
}

export async function getNftMetadata(
  tokenId: string,
  chainIdOverride?: number
): Promise<NormalizedTokenMetadata> {
  const { contractAddress, cacheTtls } = getEnvConfig(chainIdOverride);
  const normalizedContract = normalizeAddress(contractAddress);
  if (!normalizedContract) {
    throw new Error("Invalid CUBIXLES_CONTRACT value");
  }

  const normalizedTokenId = normalizeTokenId(tokenId);
  if (!normalizedTokenId) {
    throw new Error("Invalid token id");
  }

  const cacheKey = `alchemy:metadata:${normalizedContract}:${normalizedTokenId}`;

  return getCachedJson(cacheKey, cacheTtls.metadata, async () => {
    const response = await alchemyFetch<AlchemyMetadataResponse>(
      "/getNFTMetadata",
      {
        contractAddress: normalizedContract,
        tokenId: normalizedTokenId,
        tokenType: "ERC721",
      },
      chainIdOverride
    );

    return {
      tokenId: normalizedTokenId,
      contractAddress: normalizeAddress(response.contract?.address) ?? normalizedContract,
      title: response.title,
      name: response.name,
      description: response.description,
      metadata: response.metadata ?? response.raw?.metadata ?? null,
      tokenUri: normalizeTokenUri(response.tokenUri ?? response.raw?.tokenUri),
      media: response.media ?? [],
      mint: normalizeMintInfo(response.mint),
    };
  });
}

export async function getOwnersForToken(
  tokenId: string,
  chainIdOverride?: number
): Promise<string[]> {
  const { contractAddress, cacheTtls } = getEnvConfig(chainIdOverride);
  const normalizedContract = normalizeAddress(contractAddress);
  const normalizedTokenId = normalizeTokenId(tokenId);

  if (!normalizedContract || !normalizedTokenId) {
    return [];
  }

  const cacheKey = `alchemy:owners:${normalizedContract}:${normalizedTokenId}`;

  return getCachedJson(cacheKey, cacheTtls.owners, async () => {
    const response = await alchemyFetch<AlchemyOwnersResponse>(
      "/getOwnersForNFT",
      {
        contractAddress: normalizedContract,
        tokenId: normalizedTokenId,
      },
      chainIdOverride
    );

    return response.owners ?? [];
  });
}
