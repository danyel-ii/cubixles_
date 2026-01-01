const GATEWAYS = [
  "https://ipfs.runfission.com/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
];

function buildGatewayUrls(ipfsUrl) {
  if (!ipfsUrl.startsWith("ipfs://")) {
    return [ipfsUrl];
  }
  const path = ipfsUrl.replace("ipfs://", "");
  return GATEWAYS.map((base) => `${base}${path}`);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return new Response(JSON.stringify({ error: "Missing url query param." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const expectsJson = url.endsWith(".json");
  const gatewayUrls = buildGatewayUrls(url);
  for (const gatewayUrl of gatewayUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(gatewayUrl, {
        signal: controller.signal,
        cache: "no-store",
        headers: expectsJson ? { Accept: "application/json" } : undefined,
      });
      if (!response.ok) {
        continue;
      }
      if (expectsJson) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          continue;
        }
      }
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Cache-Control", "public, max-age=300");
      headers.delete("content-encoding");
      headers.delete("content-length");
      headers.delete("transfer-encoding");
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: response.status,
        headers,
      });
    } catch (error) {
      // try next gateway
    } finally {
      clearTimeout(timeout);
    }
  }
  return new Response(JSON.stringify({ error: "All IPFS gateways failed." }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });
}
