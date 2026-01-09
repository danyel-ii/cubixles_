const IPFS_GATEWAYS = [
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
];

const ALLOWED_GATEWAY_HOSTS = new Set(
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
  if (!ALLOWED_GATEWAY_HOSTS.has(parsed.hostname)) {
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

export function buildGatewayUrls({ path, search }) {
  const suffix = `${path}${search || ""}`;
  return IPFS_GATEWAYS.map((base) => `${base}${suffix}`);
}
