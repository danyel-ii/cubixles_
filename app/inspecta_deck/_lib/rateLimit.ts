type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type TokenBucketEntry = {
  tokens: number;
  lastRefill: number;
};

type RateLimitStore = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlMs: number) => Promise<void>;
  incr: (key: string, ttlMs: number) => Promise<RateLimitEntry>;
};

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();
let storePromise: Promise<RateLimitStore> | null = null;

function getNow() {
  return Date.now();
}

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createMemoryStore(): RateLimitStore {
  return {
    async get(key) {
      const entry = memoryStore.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt <= getNow()) {
        memoryStore.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlMs) {
      const ttl = Math.max(ttlMs, 0);
      const expiresAt = ttl > 0 ? getNow() + ttl : getNow();
      memoryStore.set(key, { value, expiresAt });
    },
    async incr(key, ttlMs) {
      const now = getNow();
      const entry = memoryStore.get(key);
      if (!entry || entry.expiresAt <= now) {
        const expiresAt = now + Math.max(ttlMs, 0);
        memoryStore.set(key, { value: "1", expiresAt });
        return { count: 1, resetAt: expiresAt };
      }

      const current = Number.parseInt(entry.value, 10);
      const nextCount = (Number.isFinite(current) ? current : 0) + 1;
      entry.value = String(nextCount);
      memoryStore.set(key, entry);
      return { count: nextCount, resetAt: entry.expiresAt };
    },
  };
}

async function getRateLimitStore(): Promise<RateLimitStore> {
  if (storePromise) {
    return storePromise;
  }

  storePromise = (async () => {
    return createMemoryStore();
  })();

  return storePromise;
}

export function getVerifyRateLimitConfig() {
  const limit = parseNumberEnv("VERIFY_RATE_LIMIT", 5);
  const windowSeconds = parseNumberEnv("VERIFY_RATE_WINDOW_SECONDS", 60);
  return {
    limit: Number.isFinite(limit) ? limit : 5,
    windowMs: (Number.isFinite(windowSeconds) ? windowSeconds : 60) * 1000,
  };
}

export function getReadRateLimitConfig() {
  const limit = parseNumberEnv("READ_RATE_LIMIT", 120);
  const windowSeconds = parseNumberEnv("READ_RATE_WINDOW_SECONDS", 60);
  return {
    limit: Number.isFinite(limit) ? limit : 120,
    windowMs: (Number.isFinite(windowSeconds) ? windowSeconds : 60) * 1000,
  };
}

export function getHelpdeskRateLimitConfig() {
  const limit = parseNumberEnv("HELPDESK_RATE_LIMIT", 10);
  const windowSeconds = parseNumberEnv("HELPDESK_RATE_WINDOW_SECONDS", 60);
  return {
    limit: Number.isFinite(limit) ? limit : 10,
    windowMs: (Number.isFinite(windowSeconds) ? windowSeconds : 60) * 1000,
  };
}

function parseTokenBucketEntry(raw: string | null): TokenBucketEntry | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as TokenBucketEntry;
    if (
      typeof parsed.tokens === "number" &&
      Number.isFinite(parsed.tokens) &&
      typeof parsed.lastRefill === "number" &&
      Number.isFinite(parsed.lastRefill)
    ) {
      return parsed;
    }
  } catch {
    // Ignore malformed entries.
  }
  return null;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const safeLimit = Math.max(1, limit);
  const safeWindowMs = Math.max(1000, windowMs);
  const store = await getRateLimitStore();
  const entry = await store.incr(key, safeWindowMs);
  return {
    allowed: entry.count <= safeLimit,
    remaining: Math.max(safeLimit - entry.count, 0),
    resetAt: entry.resetAt,
  };
}

export async function checkTokenBucket(
  key: string,
  capacity: number,
  windowMs: number
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const safeCapacity = Math.max(1, capacity);
  const safeWindowMs = Math.max(1000, windowMs);
  const refillRate = safeCapacity / safeWindowMs;
  const now = getNow();
  const store = await getRateLimitStore();

  const existing = parseTokenBucketEntry(await store.get(key));
  const entry = existing ?? {
    tokens: safeCapacity,
    lastRefill: now,
  };

  const elapsed = now - entry.lastRefill;
  const refilled = Math.min(safeCapacity, entry.tokens + elapsed * refillRate);
  const allowed = refilled >= 1;
  const remaining = allowed ? refilled - 1 : refilled;

  await store.set(
    key,
    JSON.stringify({
      tokens: remaining,
      lastRefill: now,
    }),
    Math.ceil(safeWindowMs * 2)
  );

  const resetAt = now + Math.ceil((safeCapacity - remaining) / refillRate);

  return {
    allowed,
    remaining: Math.max(Math.floor(remaining), 0),
    resetAt,
  };
}
