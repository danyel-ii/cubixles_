import { isAllowedProxyProtocol } from "../shared/uri-policy.js";

const DEFAULT_TIMEOUT_MS = 12_000;

function parseAllowlist(raw) {
  if (!raw || typeof raw !== "string") {
    return [];
  }
  return raw
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function hostMatches(host, entry) {
  if (entry === "*") {
    return true;
  }
  if (entry.startsWith("*.")) {
    const suffix = entry.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === entry;
}

export function isHostAllowed(hostname, allowlist) {
  if (!allowlist || allowlist.length === 0) {
    return false;
  }
  const host = hostname.toLowerCase();
  return allowlist.some((entry) => hostMatches(host, entry));
}

export function getHostAllowlist(envKey, defaults = []) {
  const envValue = process.env[envKey];
  const parsed = parseAllowlist(envValue);
  const base = defaults.map((entry) => entry.toLowerCase());
  if (!parsed.length) {
    return base;
  }
  const combined = [...base, ...parsed.map((entry) => entry.toLowerCase())];
  return Array.from(new Set(combined));
}

function isPrivateIpv4(hostname) {
  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
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

export function isBlockedHost(hostname) {
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
  return isPrivateIpv4(host);
}

async function readStreamWithLimit(stream, maxBytes, controller) {
  if (!stream) {
    return { buffer: Buffer.alloc(0), size: 0 };
  }
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      size += value.length;
      if (maxBytes && size > maxBytes) {
        controller.abort();
        const error = new Error("Response too large.");
        error.status = 413;
        throw error;
      }
      chunks.push(Buffer.from(value));
    }
  }
  return { buffer: Buffer.concat(chunks), size };
}

export async function safeFetch(
  target,
  {
    allowlist = [],
    maxBytes,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers,
    redirect = "follow",
  } = {}
) {
  const url = new URL(target);
  if (!isAllowedProxyProtocol(url.protocol)) {
    const error = new Error("Unsupported protocol.");
    error.status = 400;
    throw error;
  }
  if (isBlockedHost(url.hostname)) {
    const error = new Error("Blocked host.");
    error.status = 400;
    throw error;
  }
  if (!isHostAllowed(url.hostname, allowlist)) {
    const error = new Error("Host not allowed.");
    error.status = 403;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      redirect,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`Upstream error (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    const contentLength = response.headers.get("content-length");
    if (maxBytes && contentLength && Number(contentLength) > maxBytes) {
      const error = new Error("Response too large.");
      error.status = 413;
      throw error;
    }
    const { buffer, size } = await readStreamWithLimit(
      response.body,
      maxBytes,
      controller
    );
    return { response, buffer, size };
  } catch (error) {
    if (error?.name === "AbortError") {
      const err = new Error("Upstream timeout.");
      err.status = 504;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
