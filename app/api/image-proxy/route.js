import { fetchWithGateways } from "../../../src/shared/ipfs-fetch.js";

export const runtime = "nodejs";

const MAX_URL_LENGTH = 2048;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
};

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local")
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4) {
    return false;
  }
  const [a, b] = ipv4.slice(1, 3).map((part) => Number(part));
  if (a === 10) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  return false;
}

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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    return buildError("Missing url parameter.");
  }
  if (raw.length > MAX_URL_LENGTH) {
    return buildError("URL too long.");
  }
  const target = raw.trim();
  if (!target) {
    return buildError("Empty url parameter.");
  }

  try {
    if (target.startsWith("ipfs://")) {
      const { response } = await fetchWithGateways(target, {
        expectsJson: false,
        timeoutMs: 12_000,
      });
      if (!response.ok) {
        return buildError(`Upstream error (${response.status}).`, response.status);
      }
      return buildProxyResponse(response);
    }

    const targetUrl = new URL(target);
    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return buildError("Unsupported protocol.");
    }
    if (isBlockedHost(targetUrl.hostname)) {
      return buildError("Blocked host.");
    }
    const response = await fetch(targetUrl.toString(), {
      redirect: "follow",
    });
    if (!response.ok) {
      return buildError(`Upstream error (${response.status}).`, response.status);
    }
    return buildProxyResponse(response);
  } catch (error) {
    return buildError("Proxy fetch failed.", 502);
  }
}
