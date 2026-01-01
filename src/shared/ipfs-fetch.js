const GATEWAYS = [
  "https://ipfs.runfission.com/ipfs/",
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

export async function fetchWithGateways(ipfsUrl, { timeoutMs = 8000 } = {}) {
  if (typeof window !== "undefined" && ipfsUrl.startsWith("ipfs://")) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `/api/ipfs?url=${encodeURIComponent(ipfsUrl)}`,
        { signal: controller.signal }
      );
      if (response.ok) {
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
