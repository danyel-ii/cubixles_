import { parseIpfsUrl, buildGatewayUrls } from "../../../src/server/ipfs.js";
import { checkRateLimit } from "../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../src/server/request.js";
import { logRequest } from "../../../src/server/log.js";
import { safeFetch, getHostAllowlist } from "../../../src/server/safe-fetch.js";
import { IPFS_GATEWAYS } from "../../../src/shared/uri-policy.js";

const MAX_IPFS_BYTES = 2 * 1024 * 1024;
const DEFAULT_ALLOWED_HOSTS = IPFS_GATEWAYS.map((gateway) => new URL(gateway).hostname);

function looksLikeJson(text) {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function buildIpfsUrlFromPath(pathSegments, search = "") {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    return null;
  }
  const joined = pathSegments.join("/");
  if (!joined) {
    return null;
  }
  return `ipfs://${joined}${search}`;
}

export async function GET(request, { params }) {
  const requestId = makeRequestId();
  const requestHost = new URL(request.url).hostname;
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`ipfs:ip:${ip}`, { capacity: 30, refillPerSec: 1 });
  if (!limit.ok) {
    logRequest({ route: "/ipfs", status: 429, requestId, bodySize: 0 });
    return new Response(JSON.stringify({ error: "Rate limit exceeded", requestId }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }

  const { search } = new URL(request.url);
  const rawUrl = buildIpfsUrlFromPath(params?.ipfsPath, search);
  if (!rawUrl) {
    logRequest({ route: "/ipfs", status: 400, requestId, bodySize: 0 });
    return new Response(JSON.stringify({ error: "Missing IPFS path.", requestId }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const parsed = parseIpfsUrl(rawUrl);
  if (!parsed) {
    logRequest({ route: "/ipfs", status: 400, requestId, bodySize: 0 });
    return new Response(JSON.stringify({ error: "Unsupported IPFS url.", requestId }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const expectsJson =
    parsed.path.endsWith(".json") || parsed.path.includes("manifest.json");
  const gatewayUrls = buildGatewayUrls(parsed).filter((gatewayUrl) => {
    try {
      return new URL(gatewayUrl).hostname !== requestHost;
    } catch {
      return false;
    }
  });
  const allowlist = getHostAllowlist("IPFS_GATEWAY_ALLOWLIST", DEFAULT_ALLOWED_HOSTS);
  for (const gatewayUrl of gatewayUrls) {
    try {
      const { response, buffer } = await safeFetch(gatewayUrl, {
        allowlist,
        maxBytes: MAX_IPFS_BYTES,
        headers: expectsJson ? { Accept: "application/json" } : undefined,
      });
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Cache-Control", "public, max-age=300");
      headers.delete("content-encoding");
      headers.delete("content-length");
      headers.delete("transfer-encoding");
      const body = buffer;
      if (expectsJson) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          continue;
        }
        const text = new TextDecoder().decode(body);
        if (!looksLikeJson(text)) {
          continue;
        }
      }
      logRequest({ route: "/ipfs", status: response.status, requestId, bodySize: 0 });
      return new Response(body, {
        status: response.status,
        headers,
      });
    } catch {
      // try next gateway
    }
  }

  logRequest({ route: "/ipfs", status: 502, requestId, bodySize: 0 });
  return new Response(JSON.stringify({ error: "All IPFS gateways failed.", requestId }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });
}
