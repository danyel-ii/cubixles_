import { getCachedJson } from "./cache";
import { normalizeTokenId } from "./normalize";

function normalizeGatewayBase(raw?: string): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    const basePath = url.pathname.replace(/\/+$/, "");
    const nextPath = basePath.endsWith("/ipfs")
      ? `${basePath}/`
      : `${basePath}/ipfs/`;
    url.pathname = nextPath;
    return url.toString();
  } catch {
    return null;
  }
}

const CUSTOM_IPFS_GATEWAY = normalizeGatewayBase(
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? process.env.IPFS_GATEWAY
);
const DEFAULT_IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];
const IPFS_GATEWAYS = [
  ...(CUSTOM_IPFS_GATEWAY ? [CUSTOM_IPFS_GATEWAY] : []),
  ...DEFAULT_IPFS_GATEWAYS,
].filter((gateway, index, list) => list.indexOf(gateway) === index);

const ARWEAVE_GATEWAYS = ["https://arweave.net/", "https://ar-io.net/"];
const DEFAULT_METADATA_TIMEOUT_MS = 8000;
const DEFAULT_METADATA_MAX_BYTES = 1024 * 1024;
const DEFAULT_METADATA_HOSTS = ["alchemy.mypinata.cloud"];
const DEFAULT_ALLOWED_HOSTS = [...IPFS_GATEWAYS, ...ARWEAVE_GATEWAYS].map(
  (gateway) => new URL(gateway).hostname.toLowerCase()
);
const METADATA_ALLOWED_HOSTS = new Set<string>([
  ...DEFAULT_ALLOWED_HOSTS,
  ...DEFAULT_METADATA_HOSTS,
  ...parseHostList(process.env.METADATA_ALLOWED_HOSTS),
]);
const METADATA_FETCH_TIMEOUT_MS = parsePositiveInt(
  process.env.METADATA_FETCH_TIMEOUT_MS,
  DEFAULT_METADATA_TIMEOUT_MS,
  1000,
  60000
);
const METADATA_MAX_BYTES = parsePositiveInt(
  process.env.METADATA_MAX_BYTES,
  DEFAULT_METADATA_MAX_BYTES,
  1024,
  10 * 1024 * 1024
);

export type ResolvedMetadata = {
  tokenId: string | null;
  rawUrl: string;
  resolvedUrl: string | null;
  metadata: Record<string, unknown> | null;
  media: {
    image: string | null;
    animation: string | null;
    imageCandidates: string[];
    animationCandidates: string[];
  };
  validation: {
    hasMedia: boolean;
    issues: string[];
  };
};

function stripIpfsPrefix(uri: string): string {
  return uri
    .replace(/^ipfs:\/\/ipfs\//i, "")
    .replace(/^ipfs:\/\//i, "");
}

function stripArweavePrefix(uri: string): string {
  return uri.replace(/^ar:\/\//i, "");
}

const IPFS_GATEWAY_HOSTS = new Set(
  IPFS_GATEWAYS.map((gateway) => new URL(gateway).hostname.toLowerCase())
);

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase();
}

function parseHostList(raw?: string): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(/[,\s]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^\*\./, ""))
    .map((entry) => {
      if (entry.includes("://")) {
        try {
          return new URL(entry).hostname;
        } catch {
          return entry;
        }
      }
      return entry.split("/")[0]?.split(":")[0] ?? entry;
    })
    .map(normalizeHost)
    .filter((entry) => entry.length > 0 && entry !== "*");
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const nums = parts.map((part) => Number.parseInt(part, 10));
  if (nums.some((num) => !Number.isFinite(num) || num < 0 || num > 255)) {
    return null;
  }
  return nums;
}

function isPrivateIpv4(nums: number[]): boolean {
  const [a, b, c] = nums;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 192 && b === 0 && (c === 0 || c === 2)) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  if (a === 198 && b === 51 && c === 100) {
    return true;
  }
  if (a === 203 && b === 0 && c === 113) {
    return true;
  }
  if (a >= 224) {
    return true;
  }
  return false;
}

function isPrivateIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized === "::1" || normalized === "::") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe80::")) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    const ipv4 = parseIpv4(normalized.slice(7));
    return ipv4 ? isPrivateIpv4(ipv4) : false;
  }
  return false;
}

function isPrivateHost(hostname: string): boolean {
  const normalized = normalizeHost(hostname);
  if (!normalized) {
    return true;
  }
  if (
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  const ipv4 = parseIpv4(normalized);
  if (ipv4 && isPrivateIpv4(ipv4)) {
    return true;
  }
  if (normalized.includes(":") && isPrivateIpv6(normalized)) {
    return true;
  }
  return false;
}

function isAllowedHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (!host) {
    return false;
  }
  const allowedHosts = Array.from(METADATA_ALLOWED_HOSTS);
  for (const allowed of allowedHosts) {
    if (host === allowed || host.endsWith(`.${allowed}`)) {
      return true;
    }
  }
  return false;
}

function filterAllowedUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const allowed: string[] = [];

  for (const candidate of urls) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        continue;
      }
      if (!isAllowedHost(url.hostname) || isPrivateHost(url.hostname)) {
        continue;
      }
      const normalized = url.toString();
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      allowed.push(normalized);
    } catch {
      continue;
    }
  }

  return allowed;
}

function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    return isAllowedHost(url.hostname) && !isPrivateHost(url.hostname);
  } catch {
    return false;
  }
}

function extractIpfsGatewayPath(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!IPFS_GATEWAY_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }
    const match = url.pathname.match(/^\/ipfs\/(.+)$/);
    if (!match) {
      return null;
    }
    const path = match[1].replace(/^\/+/, "");
    if (!path || path.includes("..")) {
      return null;
    }
    return `${path}${url.search}`;
  } catch {
    return null;
  }
}

function buildGatewayUrls(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return [];
  }
  const lower = trimmed.toLowerCase();

  if (lower.startsWith("ipfs://")) {
    const path = stripIpfsPrefix(trimmed);
    return filterAllowedUrls(IPFS_GATEWAYS.map((gateway) => `${gateway}${path}`));
  }

  if (lower.startsWith("ar://")) {
    const path = stripArweavePrefix(trimmed);
    return filterAllowedUrls(ARWEAVE_GATEWAYS.map((gateway) => `${gateway}${path}`));
  }

  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    const gatewayPath = extractIpfsGatewayPath(trimmed);
    if (gatewayPath) {
      return filterAllowedUrls(
        IPFS_GATEWAYS.map((gateway) => `${gateway}${gatewayPath}`)
      );
    }
    return filterAllowedUrls([trimmed]);
  }

  return [];
}

async function readJsonWithLimit(
  response: Response,
  maxBytes: number
): Promise<Record<string, unknown> | null> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const length = Number.parseInt(contentLength, 10);
    if (Number.isFinite(length) && length > maxBytes) {
      return null;
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > maxBytes) {
      return null;
    }
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  try {
    const text = new TextDecoder().decode(buffer);
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function fetchJsonWithFallback(urls: string[]): Promise<{
  data: Record<string, unknown> | null;
  resolvedUrl: string | null;
}> {
  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        continue;
      }
      if (!isAllowedUrl(response.url)) {
        continue;
      }
      const json = await readJsonWithLimit(response, METADATA_MAX_BYTES);
      if (!json) {
        continue;
      }
      return { data: json, resolvedUrl: url };
    } catch {
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { data: null, resolvedUrl: null };
}

function pickString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function extractMedia(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return { imageRaw: null, animationRaw: null };
  }

  const imageRaw =
    pickString(metadata.image) ??
    pickString(metadata.image_url) ??
    pickString(metadata.imageUrl) ??
    pickString(metadata.imageURI) ??
    pickString(metadata.image_uri) ??
    null;

  const animationRaw =
    pickString(metadata.animation_url) ??
    pickString(metadata.animationUrl) ??
    pickString(metadata.animationURI) ??
    pickString(metadata.animation_uri) ??
    null;

  return { imageRaw, animationRaw };
}

function validateMetadata(metadata: Record<string, unknown> | null) {
  const issues: string[] = [];
  const { imageRaw, animationRaw } = extractMedia(metadata);

  if (!imageRaw && !animationRaw) {
    issues.push("metadata_missing_media");
  }

  return {
    hasMedia: Boolean(imageRaw || animationRaw),
    issues,
  };
}

export async function resolveMetadata(
  tokenId: string | null,
  rawUrl: string,
  ttlSeconds: number
): Promise<ResolvedMetadata> {
  const normalizedTokenId = normalizeTokenId(tokenId ?? undefined);
  const cacheKey = `metadata:resolved:${rawUrl}`;

  return getCachedJson(cacheKey, ttlSeconds, async () => {
    const urls = buildGatewayUrls(rawUrl);
    const { data, resolvedUrl } = await fetchJsonWithFallback(urls);
    const { imageRaw, animationRaw } = extractMedia(data);
    const imageCandidates = imageRaw ? buildGatewayUrls(imageRaw) : [];
    const animationCandidates = animationRaw ? buildGatewayUrls(animationRaw) : [];
    const validation = validateMetadata(data);

    return {
      tokenId: normalizedTokenId,
      rawUrl,
      resolvedUrl,
      metadata: data,
      media: {
        image: imageCandidates[0] ?? null,
        animation: animationCandidates[0] ?? null,
        imageCandidates,
        animationCandidates,
      },
      validation,
    };
  });
}

export function resolveMetadataFromObject(
  tokenId: string | null,
  metadata: Record<string, unknown> | null
): ResolvedMetadata {
  const normalizedTokenId = normalizeTokenId(tokenId ?? undefined);
  const { imageRaw, animationRaw } = extractMedia(metadata);
  const imageCandidates = imageRaw ? buildGatewayUrls(imageRaw) : [];
  const animationCandidates = animationRaw ? buildGatewayUrls(animationRaw) : [];
  const validation = validateMetadata(metadata);

  return {
    tokenId: normalizedTokenId,
    rawUrl: "",
    resolvedUrl: null,
    metadata,
    media: {
      image: imageCandidates[0] ?? null,
      animation: animationCandidates[0] ?? null,
      imageCandidates,
      animationCandidates,
    },
    validation,
  };
}
