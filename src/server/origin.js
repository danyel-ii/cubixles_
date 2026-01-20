const DEFAULT_ENV_KEY = "CUBIXLES_ALLOWED_ORIGINS";

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

function normalizeOrigin(raw) {
  if (!raw || raw === "null") {
    return null;
  }
  try {
    const url = new URL(raw);
    return {
      origin: url.origin.toLowerCase(),
      host: url.hostname.toLowerCase(),
      hostWithPort: url.host.toLowerCase(),
      port: url.port || "",
    };
  } catch {
    return null;
  }
}

function isOriginAllowed(origin, allowlist) {
  if (!allowlist || allowlist.length === 0) {
    return true;
  }
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  return allowlist.some((entry) => {
    if (entry === "*") {
      return true;
    }
    if (entry.startsWith("http://") || entry.startsWith("https://")) {
      return normalized.origin === entry;
    }
    if (entry.includes(":")) {
      const [entryHost, entryPort] = entry.split(":");
      if (entryPort !== normalized.port) {
        return false;
      }
      return hostMatches(normalized.host, entryHost);
    }
    return (
      hostMatches(normalized.host, entry) || normalized.hostWithPort === entry
    );
  });
}

export function enforceOriginAllowlist(request, { envKey = DEFAULT_ENV_KEY } = {}) {
  const allowlist = parseAllowlist(process.env[envKey]);
  if (!allowlist.length) {
    return { ok: true };
  }
  const originHeader =
    request.headers.get("origin") || request.headers.get("referer");
  if (!originHeader) {
    return { ok: false, status: 403, error: "Missing origin." };
  }
  const normalized = normalizeOrigin(originHeader);
  if (!normalized) {
    return { ok: false, status: 403, error: "Invalid origin." };
  }
  if (!isOriginAllowed(normalized.origin, allowlist)) {
    return { ok: false, status: 403, error: "Origin not allowed." };
  }
  return { ok: true, origin: normalized.origin };
}
