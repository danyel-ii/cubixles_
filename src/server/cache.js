import { buildRedisKey, getRedis } from "./redis.js";
import { recordMetric } from "./metrics.js";

const cache = new Map();
const MAX_ENTRIES = 1000;

function nowMs() {
  return Date.now();
}

export async function getCache(key) {
  const redis = getRedis();
  if (redis) {
    const cached = await redis.get(buildRedisKey(key));
    if (cached) {
      recordMetric("cache.hit", { layer: "redis" });
      return cached;
    }
    recordMetric("cache.miss", { layer: "redis" });
    return null;
  }

  const entry = cache.get(key);
  if (!entry) {
    recordMetric("cache.miss", { layer: "memory" });
    return null;
  }
  if (entry.expiresAt && entry.expiresAt <= nowMs()) {
    cache.delete(key);
    recordMetric("cache.miss", { layer: "memory" });
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  recordMetric("cache.hit", { layer: "memory" });
  return entry.value;
}

export async function setCache(key, value, ttlMs) {
  const redis = getRedis();
  if (redis) {
    const redisKey = buildRedisKey(key);
    if (ttlMs) {
      await redis.set(redisKey, value, { px: ttlMs });
    } else {
      await redis.set(redisKey, value);
    }
    return;
  }

  const expiresAt = ttlMs ? nowMs() + ttlMs : null;
  cache.set(key, { value, expiresAt });
  if (cache.size > MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

export async function clearCache(key) {
  const redis = getRedis();
  if (redis) {
    await redis.del(buildRedisKey(key));
    return;
  }
  cache.delete(key);
}
