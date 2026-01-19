"use server";

import type { MintedCube } from "../_data/minted-cube";
import {
  CUBIXLES_MINTED_CUBES,
  getMintedCube,
} from "../_data/minted-cube";
import { MINT_AUDIT } from "../_data/mint-audit";
import {
  resolveMetadata,
  resolveMetadataFromObject,
} from "./metadata";
import { getCachedJson } from "./cache";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_TRANSFER_PAGES = 3;
const DEFAULT_CHAIN_ID =
  process.env.CUBIXLES_CHAIN_ID ?? process.env.BASE_CHAIN_ID ?? "1";
const DEFAULT_METADATA_TTL = 86400;

const NETWORK_LABELS: Record<string, string> = {
  "1": "Ethereum Mainnet",
  "5": "Goerli",
  "8453": "Base Mainnet",
};

const ALCHEMY_BASE_BY_CHAIN_ID: Record<number, string> = {
  1: "https://eth-mainnet.g.alchemy.com",
  5: "https://eth-goerli.g.alchemy.com",
  11155111: "https://eth-sepolia.g.alchemy.com",
  8453: "https://base-mainnet.g.alchemy.com",
  84532: "https://base-sepolia.g.alchemy.com",
};

const FACE_IDS = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"] as const;

const FALLBACK_STATIC_CUBE =
  CUBIXLES_MINTED_CUBES[MINT_AUDIT.tokenId] ??
  Object.values(CUBIXLES_MINTED_CUBES)[0] ??
  null;

type AlchemyAssetTransfer = {
  erc721TokenId?: string;
  from?: string;
  to?: string;
  metadata?: {
    blockTimestamp?: string;
  };
};

type AlchemyTransferResponse = {
  transfers?: AlchemyAssetTransfer[];
  pageKey?: string;
};

type AlchemyNftMetadataResponse = {
  metadata?: Record<string, unknown>;
  tokenUri?: {
    gateway?: string;
    raw?: string;
  };
};

type AlchemyMedia = {
  gateway?: string;
  raw?: string;
  thumbnail?: string;
  format?: string;
};

type ExternalNftMetadata = {
  title?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  tokenUri?: {
    gateway?: string;
    raw?: string;
  } | null;
  media?: AlchemyMedia[];
};

let transferCache: AlchemyAssetTransfer[] | null = null;
const liveCubeCache: Record<string, Promise<MintedCube | null>> = {};

function readEnvValue(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTokenId(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return BigInt(value).toString();
  } catch {
    return value;
  }
}

function normalizeAddress(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function parseChainId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function resolveContractAddress(): string | undefined {
  const chainId = parseChainId(DEFAULT_CHAIN_ID);
  if (chainId === 8453) {
    const baseContract = readEnvValue("CUBIXLES_BASE_CONTRACT_ADDRESS");
    if (baseContract) {
      return baseContract;
    }
  }
  return (
    readEnvValue("CUBIXLES_CONTRACT_ADDRESS") ??
    readEnvValue("CUBIXLES_CONTRACT")
  );
}

function resolveAlchemyApiKey(): string | undefined {
  return readEnvValue("ALCHEMY_API_KEY") ?? readEnvValue("ALCHEMY_KEY");
}

function truncateMiddle(value: string, start = 6, end = 4) {
  if (value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function getNetworkLabel(): string {
  return NETWORK_LABELS[DEFAULT_CHAIN_ID] ?? `Chain ${DEFAULT_CHAIN_ID}`;
}

function getAlchemyBase(chainId?: number): string {
  const fallbackChainId = parseChainId(DEFAULT_CHAIN_ID) ?? 1;
  const resolvedChainId = chainId ?? fallbackChainId;
  return ALCHEMY_BASE_BY_CHAIN_ID[resolvedChainId] ?? ALCHEMY_BASE_BY_CHAIN_ID[1];
}

function getMetadataTtl(): number {
  const raw = process.env.CACHE_TTL_METADATA;
  if (!raw) {
    return DEFAULT_METADATA_TTL;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_METADATA_TTL;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureRecordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (isRecord(value)) {
    return [value];
  }
  return [];
}

function normalizeFaceCandidates(source: unknown): Record<string, unknown>[] {
  if (Array.isArray(source)) {
    return source.filter(isRecord);
  }

  if (isRecord(source)) {
    const entries = Object.entries(source).filter(([, value]) => isRecord(value));
    if (entries.length) {
      return entries.map(([key, value]) => {
        const record = value as Record<string, unknown>;
        if (
          isFaceId(key) &&
          !("faceId" in record) &&
          !("id" in record) &&
          !("label" in record)
        ) {
          return { ...record, faceId: key };
        }
        return record;
      });
    }
    return [source];
  }

  return [];
}

function extractProvenanceEntries(
  provenance: Record<string, unknown>
): Record<string, unknown>[] {
  const candidates = [
    provenance.nfts,
    provenance.refsFaces,
    provenance.refs_faces,
    provenance.refs,
    provenance.refsCanonical,
    provenance.refs_canonical,
  ];

  for (const candidate of candidates) {
    const entries = ensureRecordArray(candidate);
    if (entries.length) {
      return entries;
    }
  }

  return [];
}

function applyProvenanceSnapshot(
  provenance: Record<string, unknown> | null,
  fallback: MintedCube["provenanceNFTs"]
): MintedCube["provenanceNFTs"] {
  if (!provenance) {
    return fallback;
  }

  const entries = extractProvenanceEntries(provenance);
  if (!entries.length) {
    return fallback;
  }

  return fallback.map((face, index) => {
    const entry = entries[index];
    if (!entry) {
      return face;
    }

    const tokenIdCandidate = pickString(
      entry.tokenId as string | undefined,
      entry.token_id as string | undefined,
      face.tokenId
    );
    const tokenId = normalizeTokenId(tokenIdCandidate) ?? face.tokenId;

    const contractAddress =
      normalizeAddress(
        pickString(
          entry.contractAddress as string | undefined,
          entry.contract_address as string | undefined,
          entry.contract as string | undefined,
          entry.address as string | undefined,
          face.contractAddress
        )
      ) ?? face.contractAddress;

    const chainId = parseChainId(entry.chainId ?? face.chainId);

    const metadataUrl = pickString(
      entry.tokenUri as string | undefined,
      entry.token_uri as string | undefined,
      entry.metadataUrl as string | undefined,
      entry.metadata_url as string | undefined,
      entry.metadataUri as string | undefined,
      entry.metadataURI as string | undefined,
      entry.metadata_uri as string | undefined,
      face.metadataUrl
    );

    const explorerUrl =
      buildOpenSeaAssetUrl(contractAddress, tokenId, chainId) ?? face.explorerUrl;

    const media = buildMediaFromProvenanceEntry(entry) ?? face.media;

    const floorEth = pickNumber(
      entry.collectionFloorEth ?? entry.collection_floor_eth
    );
    const floorDate = formatSnapshotDate(
      pickString(
        entry.collectionFloorRetrievedAt as string | undefined,
        entry.collection_floor_retrieved_at as string | undefined
      )
    );
    const floorNote =
      floorEth !== undefined
        ? `Floor ${floorEth} ETH${floorDate ? ` · ${floorDate}` : ""}`
        : undefined;

    return {
      ...face,
      tokenId,
      contractAddress,
      chainId,
      metadataUrl,
      explorerUrl,
      media,
      ownerNote: floorNote ?? face.ownerNote,
    };
  });
}

function pickString(...values: (string | undefined | null)[]): string | undefined {
  for (const value of values) {
    if (value && typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function pickNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function formatSnapshotDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().split("T")[0] ?? value;
}

function buildOpenSeaAssetUrl(
  contractAddress?: string,
  tokenId?: string,
  chainId?: number
): string | undefined {
  if (!contractAddress || !tokenId) {
    return undefined;
  }
  const chainSlug = chainId === 8453 ? "base" : "ethereum";
  return `https://opensea.io/assets/${chainSlug}/${contractAddress}/${tokenId}`;
}

function formatContractLabel(address?: string): string | undefined {
  if (!address) {
    return undefined;
  }
  return `Contract ${truncateMiddle(address)}`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractStringValues(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractStringValues(entry));
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap((entry) => extractStringValues(entry));
  }
  return [];
}

function buildMediaFromCandidates(
  imageCandidates: string[],
  animationCandidates: string[] = []
): MintedCube["media"] | null {
  const images = uniqueStrings(imageCandidates);
  const animations = uniqueStrings(animationCandidates);
  if (!images.length && !animations.length) {
    return null;
  }
  return {
    image: images[0] ?? null,
    animation: animations[0] ?? null,
    imageCandidates: images,
    animationCandidates: animations,
  };
}

function buildMediaFromProvenanceEntry(
  entry: Record<string, unknown>
): MintedCube["media"] | null {
  const imageCandidates = uniqueStrings(
    extractStringValues(
      entry.image ??
        entry.image_url ??
        entry.imageUrl ??
        entry.imageURI ??
        entry.image_uri
    )
  );
  return buildMediaFromCandidates(imageCandidates);
}

function isFaceId(value?: string): value is (typeof FACE_IDS)[number] {
  return value ? FACE_IDS.includes(value as (typeof FACE_IDS)[number]) : false;
}

function buildProvenanceNFT(
  source: Record<string, unknown>,
  fallback?: MintedCube["provenanceNFTs"][number]
): MintedCube["provenanceNFTs"][number] {
  const metadataCandidate = isRecord(source.metadata) ? source.metadata : null;

  const metadataUrl = pickString(
    source.metadataUrl as string | undefined,
    source.metadata_url as string | undefined,
    source.metadataUri as string | undefined,
    source.metadataURI as string | undefined,
    source.metadata_uri as string | undefined,
    source.metadata as string | undefined,
    metadataCandidate?.gateway as string | undefined,
    metadataCandidate?.raw as string | undefined,
    fallback?.metadataUrl
  );

  const faceIdCandidate = pickString(
    source.faceId as string | undefined,
    source.id as string | undefined,
    source.label as string | undefined,
    fallback?.faceId
  );

  const tokenId =
    pickString(
      source.tokenId as string | undefined,
      source.token_id as string | undefined,
      fallback?.tokenId
    ) ?? fallback?.tokenId ??
    "";

  const contractAddress =
    normalizeAddress(
      pickString(
        source.contractAddress as string | undefined,
        source.contract_address as string | undefined,
        source.contract as string | undefined,
        source.address as string | undefined,
        fallback?.contractAddress
      )
    ) ?? fallback?.contractAddress;
  const chainId = parseChainId(source.chainId ?? fallback?.chainId);

  const candidateMedia = metadataCandidate
    ? resolveMetadataFromObject(tokenId || null, metadataCandidate).media
    : null;
  const sourceMedia = resolveMetadataFromObject(tokenId || null, source).media;
  const media = hasMedia(candidateMedia)
    ? candidateMedia
    : hasMedia(sourceMedia)
      ? sourceMedia
      : fallback?.media;

  return {
    faceId: isFaceId(faceIdCandidate) ? faceIdCandidate : fallback?.faceId ?? "+X",
    title:
      pickString(
        source.title as string | undefined,
        source.name as string | undefined,
        source.label as string | undefined,
        fallback?.title
      ) ?? fallback?.title ??
      "",
    collection:
      pickString(
        source.collection as string | undefined,
        source.series as string | undefined,
        source.family as string | undefined,
        fallback?.collection
      ) ?? fallback?.collection ??
      "",
    tokenId,
    contractAddress,
    chainId,
    ownerNote:
      pickString(
        source.ownerNote as string | undefined,
        source.owner_note as string | undefined,
        source.note as string | undefined,
        fallback?.ownerNote
      ) ?? fallback?.ownerNote ??
      "",
    description:
      pickString(
        source.description as string | undefined,
        source.summary as string | undefined,
        source.detail as string | undefined,
        fallback?.description
      ) ?? fallback?.description ??
      "",
    explorerUrl:
      pickString(
        source.explorerUrl as string | undefined,
        source.explorer_url as string | undefined,
        source.explorer as string | undefined,
        source.url as string | undefined,
        fallback?.explorerUrl
      ) ?? fallback?.explorerUrl ??
      "",
    metadataUrl,
    media,
  };
}

function parseProvenanceNFTs(
  source: unknown,
  fallback: MintedCube["provenanceNFTs"]
): MintedCube["provenanceNFTs"] {
  const candidates = normalizeFaceCandidates(source);
  if (!candidates.length) {
    return fallback;
  }

  const merged = fallback.map((fallbackFace, index) => {
    const candidate = candidates[index];
    if (!candidate) {
      return { ...fallbackFace };
    }
    return buildProvenanceNFT(candidate, fallbackFace);
  });

  if (candidates.length > merged.length) {
    merged.push(
      ...candidates.slice(merged.length).map((candidate) => buildProvenanceNFT(candidate))
    );
  }

  return merged;
}

function parseReferences(
  source: unknown,
  fallback: MintedCube["references"]
): MintedCube["references"] {
  const records = ensureRecordArray(source);
  if (!records.length) {
    return fallback;
  }

  const parsed = records
    .map((record) => {
      const label = pickString(
        record.label as string | undefined,
        record.title as string | undefined,
        record.name as string | undefined
      );
      const url = pickString(
        record.url as string | undefined,
        record.link as string | undefined,
        record.href as string | undefined
      );
      if (label && url) {
        return { label, url };
      }
      return null;
    })
    .filter((entry): entry is { label: string; url: string } => entry !== null);

  return parsed.length ? parsed : fallback;
}

function parseProvenanceTrail(
  source: unknown,
  fallback: MintedCube["provenanceTrail"]
): MintedCube["provenanceTrail"] {
  const entries = ensureRecordArray(source);
  if (!entries.length) {
    return fallback;
  }

  const parsed = entries
    .map((entry) => {
      const title = pickString(
        entry.title as string | undefined,
        entry.label as string | undefined,
        entry.stage as string | undefined
      );
      const detail = pickString(
        entry.detail as string | undefined,
        entry.description as string | undefined,
        entry.body as string | undefined
      );
      if (!title || !detail) {
        return null;
      }
      const referenceRecord =
        (entry.reference && isRecord(entry.reference) ? entry.reference : null) ??
        (entry.link && isRecord(entry.link) ? entry.link : null);
      let reference: MintedCube["provenanceTrail"][number]["reference"] | undefined;
      if (referenceRecord) {
        const label = pickString(
          referenceRecord.label as string | undefined,
          referenceRecord.title as string | undefined
        );
        const url = pickString(
          referenceRecord.url as string | undefined,
          referenceRecord.href as string | undefined,
          referenceRecord.link as string | undefined
        );
        if (label && url) {
          reference = { label, url };
        }
      }

      return {
        title,
        detail,
        reference,
      };
    })
    .filter((entry) => Boolean(entry && entry.title && entry.detail)) as
    MintedCube["provenanceTrail"];

  return parsed.length ? parsed : fallback;
}

function hasMedia(media?: MintedCube["media"] | null): boolean {
  return Boolean(media?.image || media?.animation);
}

async function resolveMediaFromUrl(
  tokenId: string | null,
  metadataUrl?: string | null
): Promise<MintedCube["media"] | null> {
  if (!metadataUrl) {
    return null;
  }
  try {
    const resolved = await resolveMetadata(tokenId, metadataUrl, getMetadataTtl());
    return resolved.media;
  } catch {
    return null;
  }
}

async function hydrateProvenanceNFTs(
  nfts: MintedCube["provenanceNFTs"]
): Promise<MintedCube["provenanceNFTs"]> {
  const hydrated = await Promise.all(
    nfts.map(async (nft) => {
      const shouldLookup = Boolean(nft.contractAddress && nft.tokenId);
      const external = shouldLookup
        ? await fetchExternalMetadata(nft.contractAddress, nft.tokenId, nft.chainId)
        : null;

      const externalTitle = pickString(external?.title, external?.name);
      const externalDescription =
        pickString(
          external?.description,
          isRecord(external?.metadata)
            ? (external?.metadata?.description as string | undefined)
            : undefined
        ) ?? undefined;
      const externalCollection = isRecord(external?.metadata)
        ? pickString(
            external?.metadata?.collection as string | undefined,
            external?.metadata?.collection_name as string | undefined,
            external?.metadata?.collectionName as string | undefined,
            external?.metadata?.project as string | undefined,
            external?.metadata?.project_name as string | undefined
          )
        : undefined;

      const contractLabel = formatContractLabel(nft.contractAddress);

      const next: MintedCube["provenanceNFTs"][number] = {
        ...nft,
        title:
          externalTitle ??
          (shouldLookup ? `Token ${nft.tokenId}` : nft.title),
        description:
          externalDescription ??
          (shouldLookup && contractLabel
            ? `Reference from ${contractLabel}.`
            : nft.description),
        collection:
          externalCollection ??
          (shouldLookup && contractLabel ? contractLabel : nft.collection),
        metadataUrl:
          nft.metadataUrl ??
          pickString(external?.tokenUri?.gateway, external?.tokenUri?.raw),
      };

      if (hasMedia(next.media)) {
        return next;
      }

      let externalMedia: MintedCube["media"] | null = null;
      if (isRecord(external?.metadata)) {
        externalMedia = resolveMetadataFromObject(
          next.tokenId || null,
          external?.metadata ?? null
        ).media;
      }

      if (!hasMedia(externalMedia) && external?.media?.length) {
        const imageCandidates = external.media
          .flatMap((media) => [media.gateway, media.raw, media.thumbnail])
          .filter((value): value is string => Boolean(value));
        externalMedia = buildMediaFromCandidates(imageCandidates);
      }

      if (!hasMedia(externalMedia)) {
        externalMedia = await resolveMediaFromUrl(next.tokenId || null, next.metadataUrl);
      }

      return hasMedia(externalMedia) ? { ...next, media: externalMedia } : next;
    })
  );

  return hydrated;
}

async function hydrateCubeMedia(
  cube: MintedCube,
  metadata: AlchemyNftMetadataResponse | null
): Promise<MintedCube> {
  const metadataRoot = metadata?.metadata ?? null;
  const metadataProperties =
    metadataRoot && isRecord(metadataRoot.properties)
      ? (metadataRoot.properties as Record<string, unknown>)
      : null;
  const objectMedia = metadataRoot
    ? resolveMetadataFromObject(cube.tokenId, metadataRoot).media
    : null;
  const propertyMedia = metadataProperties
    ? resolveMetadataFromObject(cube.tokenId, metadataProperties).media
    : null;

  let cubeMedia = hasMedia(objectMedia)
    ? objectMedia
    : hasMedia(propertyMedia)
      ? propertyMedia
      : cube.media ?? null;

  if (!hasMedia(cubeMedia)) {
    const metadataUrl = pickString(metadata?.tokenUri?.gateway, metadata?.tokenUri?.raw);
    const resolved = await resolveMediaFromUrl(cube.tokenId, metadataUrl);
    if (resolved) {
      cubeMedia = resolved;
    }
  }

  const provenanceNFTs = await hydrateProvenanceNFTs(cube.provenanceNFTs);

  return {
    ...cube,
    media: cubeMedia ?? cube.media,
    provenanceNFTs,
  };
}

async function fetchMintTransfers(): Promise<AlchemyAssetTransfer[]> {
  if (transferCache) {
    return transferCache;
  }

  const rpcUrl = process.env.MAINNET_RPC_URL;
  const contractAddress = resolveContractAddress();
  if (!rpcUrl || !contractAddress) {
    return [];
  }

  const collected: AlchemyAssetTransfer[] = [];
  let pageKey: string | undefined;
  let iterations = 0;

  while (iterations < MAX_TRANSFER_PAGES) {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [
        {
          fromBlock: "0x0",
          toBlock: "latest",
          category: ["erc721"],
          contractAddresses: [contractAddress],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: "0x64",
          order: "asc",
          ...(pageKey ? { pageKey } : {}),
        },
      ],
    });

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    if (!response.ok) {
      break;
    }

    const json = (await response.json()) as { result?: AlchemyTransferResponse };
    const result = json.result;
    if (!result?.transfers?.length) {
      break;
    }

    collected.push(...result.transfers);
    pageKey = result.pageKey;
    if (!pageKey) {
      break;
    }

    iterations += 1;
  }

  transferCache = collected.filter(
    (transfer) => transfer.from?.toLowerCase() === ZERO_ADDRESS
  );
  return transferCache;
}

async function fetchMintTransfer(tokenId: string): Promise<AlchemyAssetTransfer | null> {
  const normalizedId = normalizeTokenId(tokenId);
  if (!normalizedId) {
    return null;
  }

  const transfers = await fetchMintTransfers();
  return transfers.find(
    (transfer) => normalizeTokenId(transfer.erc721TokenId) === normalizedId
  ) ?? null;
}

async function fetchMetadata(tokenId: string): Promise<AlchemyNftMetadataResponse | null> {
  const apiKey = resolveAlchemyApiKey();
  const contractAddress = resolveContractAddress();
  if (!apiKey || !contractAddress) {
    return null;
  }

  const base = getAlchemyBase(parseChainId(DEFAULT_CHAIN_ID));
  const url = new URL(`${base}/nft/v2/${apiKey}/getNFTMetadata`);
  url.searchParams.set("contractAddress", contractAddress);
  url.searchParams.set("tokenId", tokenId);
  url.searchParams.set("refreshCache", "false");

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AlchemyNftMetadataResponse;
}

async function fetchExternalMetadata(
  contractAddress?: string,
  tokenId?: string,
  chainId?: number
): Promise<ExternalNftMetadata | null> {
  const apiKey = resolveAlchemyApiKey();
  if (!apiKey || !contractAddress || !tokenId) {
    return null;
  }

  const normalizedContract = normalizeAddress(contractAddress);
  if (!normalizedContract) {
    return null;
  }

  const cacheKey = `alchemy:external:${chainId ?? "default"}:${normalizedContract}:${tokenId}`;
  return getCachedJson(cacheKey, getMetadataTtl(), async () => {
    try {
      const base = getAlchemyBase(chainId);
      const url = new URL(`${base}/nft/v2/${apiKey}/getNFTMetadata`);
      url.searchParams.set("contractAddress", normalizedContract);
      url.searchParams.set("tokenId", tokenId);
      url.searchParams.set("tokenType", "ERC721");
      url.searchParams.set("refreshCache", "false");

      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as {
        title?: string;
        name?: string;
        description?: string;
        metadata?: Record<string, unknown>;
        raw?: {
          metadata?: Record<string, unknown>;
          tokenUri?: string;
        };
        tokenUri?: {
          gateway?: string;
          raw?: string;
        };
        media?: AlchemyMedia[];
      };

      const tokenUri =
        (isRecord(json.tokenUri)
          ? {
              gateway: pickString(json.tokenUri.gateway),
              raw: pickString(json.tokenUri.raw),
            }
          : null) ??
        (json.raw?.tokenUri
          ? { raw: String(json.raw.tokenUri), gateway: undefined }
          : null);

      return {
        title: json.title,
        name: json.name,
        description: json.description,
        metadata: json.metadata ?? json.raw?.metadata ?? null,
        tokenUri,
        media: json.media ?? [],
      } satisfies ExternalNftMetadata;
    } catch {
      return null;
    }
  });
}

function mergeMintedCube(
  tokenId: string,
  fallback: MintedCube,
  transfer: AlchemyAssetTransfer | null,
  metadata: AlchemyNftMetadataResponse | null
): MintedCube {
  const metadataRoot = metadata?.metadata ?? null;
  const metadataProperties =
    metadataRoot && isRecord(metadataRoot.properties)
      ? (metadataRoot.properties as Record<string, unknown>)
      : null;

  const mintedAt =
    transfer?.metadata?.blockTimestamp
      ? new Date(transfer.metadata.blockTimestamp).toISOString()
      : fallback.mintedAt;
  const mintedBy = pickString(transfer?.to, fallback.mintedBy) ?? fallback.mintedBy;
  const description =
    pickString(
      metadataRoot?.description as string | undefined,
      metadataRoot?.summary as string | undefined,
      fallback.description
    ) ?? fallback.description;
  const provenanceNote =
    pickString(
      metadataRoot?.provenanceNote as string | undefined,
      metadataProperties?.provenanceNote as string | undefined,
      fallback.provenanceNote
    ) ?? fallback.provenanceNote;
  const tokenViewUrl =
    pickString(
      metadataRoot?.external_url as string | undefined,
      metadata?.tokenUri?.gateway,
      metadata?.tokenUri?.raw,
      fallback.tokenViewUrl
    ) ?? fallback.tokenViewUrl;

  const references = parseReferences(
    metadataProperties?.references ?? metadataRoot?.references ?? metadataRoot?.links,
    fallback.references
  );

  const provenanceRecord =
    metadataRoot && isRecord(metadataRoot.provenance)
      ? (metadataRoot.provenance as Record<string, unknown>)
      : null;

  const parsedProvenanceNFTs = parseProvenanceNFTs(
    metadataProperties?.faces ?? metadataRoot?.faces,
    fallback.provenanceNFTs
  );

  const provenanceNFTs = applyProvenanceSnapshot(
    provenanceRecord,
    parsedProvenanceNFTs
  );

  const provenanceTrail = parseProvenanceTrail(
    metadataProperties?.provenanceTrail ?? metadataRoot?.provenanceTrail,
    fallback.provenanceTrail
  );

  return {
    ...fallback,
    tokenId,
    network: getNetworkLabel(),
    mintedAt,
    mintedBy,
    description,
    provenanceNote,
    tokenViewUrl,
    references,
    provenanceNFTs,
    provenanceTrail,
  };
}

async function buildLiveCube(tokenId: string): Promise<MintedCube | null> {
  const normalizedRequestId = normalizeTokenId(tokenId);
  if (!normalizedRequestId) {
    return null;
  }

  const staticCube = getMintedCube(normalizedRequestId);
  const canonicalTokenId = staticCube?.tokenId ?? normalizedRequestId;

  const [transfer, metadata] = await Promise.all([
    fetchMintTransfer(canonicalTokenId),
    fetchMetadata(canonicalTokenId),
  ]);

  if (!transfer && !metadata) {
    return null;
  }

  const fallbackCube = staticCube ?? FALLBACK_STATIC_CUBE;
  if (!fallbackCube) {
    return null;
  }

  const mergedCube = mergeMintedCube(canonicalTokenId, fallbackCube, transfer, metadata);
  return hydrateCubeMedia(mergedCube, metadata);
}

export async function getLiveMintedCube(tokenId?: string): Promise<MintedCube | null> {
  const normalizedId = normalizeTokenId(tokenId ?? undefined);
  if (!normalizedId) {
    return null;
  }

  if (!liveCubeCache[normalizedId]) {
    liveCubeCache[normalizedId] = buildLiveCube(normalizedId);
  }

  return liveCubeCache[normalizedId];
}

export async function getLiveMintedCubes(): Promise<MintedCube[]> {
  const transfers = await fetchMintTransfers();
  const uniqueIds = Array.from(
    new Set(
      transfers
        .map((transfer) => normalizeTokenId(transfer.erc721TokenId))
        .filter((id): id is string => Boolean(id))
    )
  );

  const cubes = await Promise.all(uniqueIds.map((tokenId) => buildLiveCube(tokenId)));
  return cubes.filter((cube): cube is MintedCube => Boolean(cube));
}
