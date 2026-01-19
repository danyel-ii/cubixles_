import { getEnvConfig } from "./env";

type CacheAdapter = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlSeconds: number) => Promise<void>;
};

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

const memoryCache = new Map<string, MemoryEntry>();
let adapterPromise: Promise<CacheAdapter> | null = null;
let redisClientPromise: Promise<any> | null = null;

function getNow(): number {
  return Date.now();
}

function createMemoryAdapter(): CacheAdapter {
  return {
    async get(key) {
      const entry = memoryCache.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt <= getNow()) {
        memoryCache.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      const ttlMs = Math.max(ttlSeconds, 0) * 1000;
      memoryCache.set(key, { value, expiresAt: getNow() + ttlMs });
    },
  };
}

async function getRedisClient(redisUrl: string): Promise<any> {
  if (!redisClientPromise) {
    const { createClient } = await import("redis");
    const client = createClient({ url: redisUrl });
    client.on("error", () => {
      // Fail silently; callers will fall back to memory cache on errors.
    });
    redisClientPromise = client.connect().then(() => client);
  }
  return redisClientPromise;
}

async function createRedisAdapter(redisUrl: string): Promise<CacheAdapter> {
  return {
    async get(key) {
      const client = await getRedisClient(redisUrl);
      const value = await client.get(key);
      return value ?? null;
    },
    async set(key, value, ttlSeconds) {
      const client = await getRedisClient(redisUrl);
      const ttl = Math.max(ttlSeconds, 0);
      if (ttl > 0) {
        await client.setEx(key, ttl, value);
        return;
      }
      await client.set(key, value);
    },
  };
}

async function createVercelKvAdapter(): Promise<CacheAdapter> {
  const { kv } = await import("@vercel/kv");
  return {
    async get(key) {
      const value = await kv.get<string>(key);
      return value ?? null;
    },
    async set(key, value, ttlSeconds) {
      const ttl = Math.max(ttlSeconds, 0);
      if (ttl > 0) {
        await kv.set(key, value, { ex: ttl });
        return;
      }
      await kv.set(key, value);
    },
  };
}

async function getCacheAdapter(): Promise<CacheAdapter> {
  if (adapterPromise) {
    return adapterPromise;
  }

  const { cacheProvider, redisUrl } = getEnvConfig();

  adapterPromise = (async () => {
    if (cacheProvider === "redis" && redisUrl) {
      try {
        return await createRedisAdapter(redisUrl);
      } catch {
        return createMemoryAdapter();
      }
    }

    if (cacheProvider === "kv") {
      try {
        return await createVercelKvAdapter();
      } catch {
        return createMemoryAdapter();
      }
    }

    return createMemoryAdapter();
  })();

  return adapterPromise;
}

export async function getCachedJson<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const adapter = await getCacheAdapter();
  const cached = await adapter.get(key);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // Ignore corrupted cache entries.
    }
  }

  const fresh = await fetcher();
  await adapter.set(key, JSON.stringify(fresh), ttlSeconds);
  return fresh;
}
