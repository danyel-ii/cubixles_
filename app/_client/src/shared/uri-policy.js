const IPFS_GATEWAYS = [
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.filebase.io/ipfs/",
  "https://ipfs.io/ipfs/",
];
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
  if (!isIpfsUri(ipfsUrl)) {
    return [ipfsUrl];
  }
  const path = ipfsUrl.replace("ipfs://", "");
  return IPFS_GATEWAYS.map((base) => `${base}${path}`);
}

export function buildImageProxyUrl(target) {
  return `${IMAGE_PROXY_PATH}${encodeURIComponent(target)}`;
}

export function isAllowedProxyProtocol(protocol) {
  return ALLOWED_PROXY_PROTOCOLS.has(protocol);
}

export { DEFAULT_IPFS_GATEWAY, IMAGE_PROXY_PATH, IPFS_GATEWAYS };
