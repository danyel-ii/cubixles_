import {
  DEFAULT_IPFS_GATEWAY,
  IMAGE_PROXY_PATH,
  buildGatewayUrls,
  buildImageProxyUrl,
  parseIpfsUrl,
} from "src/shared/uri-policy.js";

export function resolveUri(original: string | null | undefined): {
  original: string;
  resolved: string;
} | null {
  if (!original) {
    return null;
  }
  const trimmed = original.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = parseIpfsUrl(trimmed);
  if (parsed) {
    return {
      original: trimmed,
      resolved: `${DEFAULT_IPFS_GATEWAY}${parsed.path}${parsed.search || ""}`,
    };
  }
  return {
    original: trimmed,
    resolved: trimmed,
  };
}

function isProxyUrl(url: string) {
  return url.startsWith(IMAGE_PROXY_PATH);
}

export function buildImageCandidates(
  input: { original: string; resolved: string } | string | null | undefined
): string[] {
  if (!input) {
    return [];
  }
  const uri =
    typeof input === "string" ? resolveUri(input) : input;
  if (!uri?.resolved) {
    return [];
  }
  const candidates = new Set<string>();
  const original = typeof input === "string" ? input : uri.original;
  const parsed = typeof original === "string" ? parseIpfsUrl(original) : null;
  if (parsed) {
    buildGatewayUrls(parsed).forEach((gatewayUrl) => candidates.add(gatewayUrl));
  } else {
    candidates.add(uri.resolved);
  }
  if (
    typeof original === "string" &&
    !original.startsWith("data:") &&
    !isProxyUrl(original)
  ) {
    candidates.add(buildImageProxyUrl(original));
  }
  return Array.from(candidates);
}
