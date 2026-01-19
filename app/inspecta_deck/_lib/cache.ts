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

async function getCacheAdapter(): Promise<CacheAdapter> {
  if (adapterPromise) {
    return adapterPromise;
  }

  adapterPromise = (async () => {
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
