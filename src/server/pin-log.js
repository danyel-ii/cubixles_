import { getRedis } from "./redis.js";

const LIST_KEY = "pinlog:entries";
const SET_KEY = "pinlog:cids";
const MAX_ENTRIES = 5000;

function nowIso() {
  return new Date().toISOString();
}

function clampLimit(limit) {
  if (!Number.isFinite(limit)) {
    return 100;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

export async function recordPinLog(entry) {
  const redis = getRedis();
  if (!redis) {
    return { ok: false, reason: "redis_unavailable" };
  }
  if (!entry?.cid) {
    return { ok: false, reason: "missing_cid" };
  }
  const payload = {
    ...entry,
    recordedAt: nowIso(),
  };
  const serialized = JSON.stringify(payload);
  await redis.sadd(SET_KEY, entry.cid);
  await redis.lpush(LIST_KEY, serialized);
  await redis.ltrim(LIST_KEY, 0, MAX_ENTRIES - 1);
  return { ok: true };
}

export async function getPinLog({ limit = 100, unique = false } = {}) {
  const redis = getRedis();
  if (!redis) {
    return { ok: false, error: "Pin log unavailable" };
  }
  if (unique) {
    const cids = await redis.smembers(SET_KEY);
    return { ok: true, cids };
  }
  const capped = clampLimit(limit);
  const entries = await redis.lrange(LIST_KEY, 0, capped - 1);
  const parsed = entries.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return { raw: item };
    }
  });
  return { ok: true, entries: parsed };
}
