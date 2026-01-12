import { buildRedisKey, getRedis } from "./redis.js";
import { recordMetric } from "./metrics.js";

const buckets = new Map();
const DEFAULT_MAX_ENTRIES = 2000;

const LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl_ms = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "tokens", "lastRefill")
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])
if not tokens then tokens = capacity end
if not lastRefill then lastRefill = now end

local elapsed = math.max(0, now - lastRefill)
local refill = elapsed * refill_per_ms
tokens = math.min(capacity, tokens + refill)

local allowed = 0
local retryAfter = 0
if tokens < 1 then
  allowed = 0
  if refill_per_ms > 0 then
    retryAfter = math.ceil((1 - tokens) / (refill_per_ms * 1000))
  else
    retryAfter = 0
  end
else
  allowed = 1
  tokens = tokens - 1
end

redis.call("HMSET", key, "tokens", tokens, "lastRefill", now)
redis.call("PEXPIRE", key, ttl_ms)

return { allowed, math.floor(tokens), retryAfter }
`;

function nowMs() {
  return Date.now();
}

function prune(maxEntries, ttlMs) {
  if (buckets.size <= maxEntries) {
    return;
  }
  const cutoff = nowMs() - ttlMs;
  for (const [key, entry] of buckets) {
    if (entry.lastSeen < cutoff) {
      buckets.delete(key);
    }
    if (buckets.size <= maxEntries) {
      return;
    }
  }
  const extra = buckets.size - maxEntries;
  if (extra > 0) {
    const keys = buckets.keys();
    for (let i = 0; i < extra; i += 1) {
      const next = keys.next();
      if (next.done) {
        break;
      }
      buckets.delete(next.value);
    }
  }
}

export async function checkRateLimit(
  key,
  {
    capacity = 10,
    refillPerSec = 1,
    ttlMs = 5 * 60 * 1000,
    maxEntries = DEFAULT_MAX_ENTRIES,
  } = {}
) {
  const redis = getRedis();
  if (redis) {
    try {
      const now = nowMs();
      const refillPerMs = refillPerSec / 1000;
      const [allowed, remaining, retryAfter] = await redis.eval(LUA, {
        keys: [buildRedisKey(`ratelimit:${key}`)],
        args: [capacity, refillPerMs, now, ttlMs],
      });
      if (!allowed) {
        recordMetric("ratelimit.blocked", { key });
      }
      return {
        ok: Boolean(allowed),
        remaining: Number(remaining) || 0,
        retryAfter: Number(retryAfter) || 0,
      };
    } catch (error) {
      recordMetric("ratelimit.redis_error");
    }
  }

  const now = nowMs();
  const entry = buckets.get(key) || {
    tokens: capacity,
    lastRefill: now,
    lastSeen: now,
  };
  const elapsed = Math.max(0, now - entry.lastRefill);
  const refill = (elapsed / 1000) * refillPerSec;
  entry.tokens = Math.min(capacity, entry.tokens + refill);
  entry.lastRefill = now;
  entry.lastSeen = now;

  if (entry.tokens < 1) {
    const retryAfter = refillPerSec > 0 ? Math.ceil((1 - entry.tokens) / refillPerSec) : 0;
    buckets.set(key, entry);
    prune(maxEntries, ttlMs);
    recordMetric("ratelimit.blocked", { key });
    return { ok: false, remaining: 0, retryAfter };
  }

  entry.tokens -= 1;
  buckets.set(key, entry);
  prune(maxEntries, ttlMs);
  return { ok: true, remaining: Math.floor(entry.tokens), retryAfter: 0 };
}
