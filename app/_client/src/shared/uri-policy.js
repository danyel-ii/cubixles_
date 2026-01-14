import { readEnvValue } from "./utils/env.js";

function normalizeGatewayBase(raw) {
  if (!raw || typeof raw !== "string") {
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
  readEnvValue("NEXT_PUBLIC_IPFS_GATEWAY")
);
const DEFAULT_IPFS_GATEWAYS = [
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.filebase.io/ipfs/",
  "https://ipfs.io/ipfs/",
];
const IPFS_GATEWAYS = [
  ...(CUSTOM_IPFS_GATEWAY ? [CUSTOM_IPFS_GATEWAY] : []),
  ...DEFAULT_IPFS_GATEWAYS,
].filter((gateway, index, list) => list.indexOf(gateway) === index);
const DEFAULT_IPFS_GATEWAY = IPFS_GATEWAYS[0];

const ALLOWED_NFT_SCHEMES = ["ipfs://", "https://", "http://", "ar://", "data:"];
const ALLOWED_PROXY_PROTOCOLS = new Set(["http:", "https:"]);
const IMAGE_PROXY_PATH = "/api/image-proxy?url=";

const IPFS_GATEWAY_HOSTS = new Set(
  IPFS_GATEWAYS.map((gateway) => new URL(gateway).hostname)
);

function normalizeIpfsPath(rawPath) {
  const trimmed = rawPath.replace(/^ipfs\//, "").replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("..")) {
    return null;
  }
  return trimmed;
}

function splitQuery(fragment) {
  const [pathPart, queryPart = ""] = fragment.split("?");
  const [query] = queryPart.split("#");
  return { pathPart, search: query ? `?${query}` : "" };
}

export function isIpfsUri(value) {
  return typeof value === "string" && value.trim().startsWith("ipfs://");
}

export function isAllowedNftUri(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (ALLOWED_NFT_SCHEMES.some((scheme) => trimmed.startsWith(scheme))) {
    return true;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (parsed.pathname.includes("/ipfs/")) {
        return true;
      }
      if (host.includes(".ipfs.") || host.startsWith("ipfs.") || host.endsWith(".ipfs")) {
        return true;
      }
      if (host.includes("ipfs")) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

export function parseIpfsUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    return null;
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("ipfs://")) {
    const { pathPart, search } = splitQuery(trimmed.slice("ipfs://".length));
    const path = normalizeIpfsPath(pathPart);
    if (!path) {
      return null;
    }
    return { path, search };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (!IPFS_GATEWAY_HOSTS.has(parsed.hostname)) {
    return null;
  }
  const match = parsed.pathname.match(/^\/ipfs\/(.+)$/);
  if (!match) {
    return null;
  }
  const path = normalizeIpfsPath(match[1]);
  if (!path) {
    return null;
  }
  return { path, search: parsed.search };
}

export function buildGatewayUrls(ipfsUrl) {
  if (typeof ipfsUrl === "string") {
    const parsed = parseIpfsUrl(ipfsUrl);
    if (!parsed) {
      return [ipfsUrl];
    }
    return IPFS_GATEWAYS.map((base) => `${base}${parsed.path}${parsed.search}`);
  }
  if (ipfsUrl && typeof ipfsUrl.path === "string") {
    const search = ipfsUrl.search || "";
    return IPFS_GATEWAYS.map((base) => `${base}${ipfsUrl.path}${search}`);
  }
  return [];
}

export function buildImageProxyUrl(target) {
  return `${IMAGE_PROXY_PATH}${encodeURIComponent(target)}`;
}

export function isAllowedProxyProtocol(protocol) {
  return ALLOWED_PROXY_PROTOCOLS.has(protocol);
}

export { DEFAULT_IPFS_GATEWAY, IMAGE_PROXY_PATH, IPFS_GATEWAYS };
