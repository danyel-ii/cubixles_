const GATEWAYS = [
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
];

export function buildGatewayUrls(ipfsUrl) {
  if (!ipfsUrl.startsWith("ipfs://")) {
    return [ipfsUrl];
  }
  const path = ipfsUrl.replace("ipfs://", "");
  return GATEWAYS.map((base) => `${base}${path}`);
}

function looksLikeJson(text) {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

async function isJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return true;
  }
  if (contentType.includes("text/html")) {
    return false;
  }
  try {
    const text = await response.clone().text();
    return looksLikeJson(text) && !text.trimStart().startsWith("<");
  } catch (error) {
    return false;
  }
}

export async function fetchWithGateways(
  ipfsUrl,
  { timeoutMs = 8000, expectsJson: expectsJsonOverride } = {}
) {
  const expectsJson =
    typeof expectsJsonOverride === "boolean"
      ? expectsJsonOverride
      : ipfsUrl.endsWith(".json") || ipfsUrl.includes("manifest.json");
  if (typeof window !== "undefined" && ipfsUrl.startsWith("ipfs://")) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `/api/ipfs?url=${encodeURIComponent(ipfsUrl)}`,
        { signal: controller.signal }
      );
      if (response.ok) {
        if (expectsJson && !(await isJsonResponse(response))) {
          throw new Error("IPFS proxy returned non-JSON.");
        }
        clearTimeout(timeout);
        return { response, url: response.url };
      }
    } catch (error) {
      // fall back to direct gateway fetch
    } finally {
      clearTimeout(timeout);
    }
  }
  const urls = buildGatewayUrls(ipfsUrl);
  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) {
        if (expectsJson && !(await isJsonResponse(response))) {
          continue;
        }
        clearTimeout(timeout);
        return { response, url };
      }
    } catch (error) {
      // try next gateway
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("All IPFS gateways failed.");
}
