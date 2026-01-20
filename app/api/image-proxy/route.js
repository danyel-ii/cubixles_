import { checkRateLimit } from "../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../src/server/request.js";
import { logRequest } from "../../../src/server/log.js";
import { safeFetch, getHostAllowlist } from "../../../src/server/safe-fetch.js";
import { buildGatewayUrls, IPFS_GATEWAYS } from "../../../src/shared/uri-policy.js";

export const runtime = "nodejs";

const MAX_URL_LENGTH = 2048;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_ALLOWED_HOSTS = [
  ...IPFS_GATEWAYS.map((gateway) => new URL(gateway).hostname),
  "arweave.net",
  "ar-io.net",
];
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
};

function buildError(message, status = 400) {
  return new Response(message, { status, headers: CORS_HEADERS });
}

function buildProxyResponse(response) {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function isAllowedImageContentType(contentType) {
  if (!contentType) {
    return true;
  }
  const normalized = contentType.toLowerCase();
  return (
    normalized.startsWith("image/") ||
    normalized.startsWith("application/octet-stream") ||
    normalized.startsWith("binary/octet-stream")
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  const requestId = makeRequestId();
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`image-proxy:ip:${ip}`, {
    capacity: 30,
    refillPerSec: 1,
  });
  if (!limit.ok) {
    logRequest({ route: "/api/image-proxy", status: 429, requestId, bodySize: 0 });
    return buildError("Rate limit exceeded.", 429);
  }
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    logRequest({ route: "/api/image-proxy", status: 400, requestId, bodySize: 0 });
    return buildError("Missing url parameter.");
  }
  if (raw.length > MAX_URL_LENGTH) {
    logRequest({ route: "/api/image-proxy", status: 400, requestId, bodySize: 0 });
    return buildError("URL too long.");
  }
  const target = raw.trim();
  if (!target) {
    logRequest({ route: "/api/image-proxy", status: 400, requestId, bodySize: 0 });
    return buildError("Empty url parameter.");
  }

  const allowlist = getHostAllowlist("IMAGE_PROXY_ALLOWED_HOSTS", DEFAULT_ALLOWED_HOSTS);

  try {
    if (target.startsWith("ipfs://")) {
      const gateways = buildGatewayUrls(target);
      for (const gatewayUrl of gateways) {
        try {
          const { response, buffer } = await safeFetch(gatewayUrl, {
            allowlist,
            maxBytes: MAX_IMAGE_BYTES,
          });
          const contentType = response.headers.get("content-type") || "";
          if (!isAllowedImageContentType(contentType)) {
            continue;
          }
          logRequest({
            route: "/api/image-proxy",
            status: response.status,
            requestId,
            bodySize: buffer.length,
          });
          return buildProxyResponse(new Response(buffer, { status: response.status, headers: response.headers }));
        } catch (error) {
          void error;
        }
      }
      logRequest({ route: "/api/image-proxy", status: 502, requestId, bodySize: 0 });
      return buildError("All IPFS gateways failed.", 502);
    }

    const targetUrl = new URL(target);
    const { response, buffer } = await safeFetch(targetUrl.toString(), {
      allowlist,
      maxBytes: MAX_IMAGE_BYTES,
    });
    const contentType = response.headers.get("content-type") || "";
    if (!isAllowedImageContentType(contentType)) {
      logRequest({ route: "/api/image-proxy", status: 415, requestId, bodySize: 0 });
      return buildError("Unsupported content type.", 415);
    }
    logRequest({
      route: "/api/image-proxy",
      status: response.status,
      requestId,
      bodySize: buffer.length,
    });
    return buildProxyResponse(new Response(buffer, { status: response.status, headers: response.headers }));
  } catch (error) {
    const status = error?.status || 502;
    logRequest({ route: "/api/image-proxy", status, requestId, bodySize: 0 });
    return buildError(error?.message || "Proxy fetch failed.", status);
  }
}
