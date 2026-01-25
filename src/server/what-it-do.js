import crypto from "node:crypto";
import { buildRedisKey, getRedis } from "./redis.js";

const MAX_WHISPERS = Number.parseInt(process.env.WHISPERS_MAX || "30", 10);
const MAX_LEADERBOARD = Number.parseInt(
  process.env.CIRCUIT_LEADERBOARD_MAX || "10",
  10
);

const WHISPERS_KEY = buildRedisKey("whatitdo:whispers");
const LEADERBOARD_KEY = buildRedisKey("whatitdo:circuit");
const RESET_AT_KEY = buildRedisKey("whatitdo:circuit:resetAt");
const CATACLYSM_COUNT_KEY = buildRedisKey("whatitdo:cataclysm:count");

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sanitizeMessage(input = "") {
  return String(input)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_WHISPERS);
}

function sanitizeTag(input = "") {
  return String(input)
    .replace(/[^a-z]/gi, "")
    .slice(0, 3)
    .toUpperCase();
}

function nextResetAt(now = Date.now()) {
  const date = new Date(now);
  date.setUTCHours(24, 0, 0, 0);
  return date.getTime();
}

async function getList(redis, key) {
  if (!redis) return [];
  const raw = await redis.lrange(key, 0, -1);
  return raw
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function setList(redis, key, items) {
  if (!redis) return;
  await redis.del(key);
  if (items.length) {
    await redis.rpush(
      key,
      ...items.map((entry) => JSON.stringify(entry))
    );
  }
}

async function ensureReset(redis) {
  if (!redis) {
    return { resetAt: nextResetAt(), reset: false };
  }
  const now = Date.now();
  let resetAt = toNumber(await redis.get(RESET_AT_KEY), 0);
  if (!resetAt || now >= resetAt) {
    resetAt = nextResetAt(now);
    await redis.set(RESET_AT_KEY, String(resetAt));
    await redis.del(LEADERBOARD_KEY);
    return { resetAt, reset: true };
  }
  return { resetAt, reset: false };
}

export async function getInitData() {
  const redis = getRedis();
  const { resetAt } = await ensureReset(redis);
  const whispers = await getList(redis, WHISPERS_KEY);
  const circuitLeaderboard = await getList(redis, LEADERBOARD_KEY);
  const cataclysmCount = toNumber(
    redis ? await redis.get(CATACLYSM_COUNT_KEY) : 0,
    0
  );
  const cataclysmProgress = Math.min(1, (cataclysmCount % 100) / 100);
  return {
    type: "init",
    whispers,
    circuitLeaderboard,
    circuitResetTime: resetAt,
    cataclysmCount,
    cataclysmProgress,
  };
}

export async function insertWhisper(payload) {
  const redis = getRedis();
  const message = sanitizeMessage(payload?.message);
  if (!message) {
    return { error: "invalid_message" };
  }
  const uuid = String(payload?.uuid || "");
  const whisper = {
    id: crypto.randomUUID(),
    uuid,
    message,
    countrycode: String(payload?.countryCode || "").toLowerCase(),
    x: toNumber(payload?.x),
    y: toNumber(payload?.y),
    z: toNumber(payload?.z),
    createdAt: Date.now(),
  };

  const current = await getList(redis, WHISPERS_KEY);
  const filtered = uuid
    ? current.filter((item) => item.uuid !== uuid)
    : current;
  const next = [whisper, ...filtered].slice(0, MAX_WHISPERS);
  await setList(redis, WHISPERS_KEY, next);

  const deleted = current.filter((item) => !next.some((n) => n.id === item.id));
  return {
    type: "whispersInsert",
    whispers: [whisper],
    deleted,
  };
}

export async function insertCircuitScore(payload) {
  const redis = getRedis();
  const tag = sanitizeTag(payload?.tag);
  const duration = toNumber(payload?.duration, 0);
  if (!tag || duration <= 0) {
    return { error: "invalid_score" };
  }
  const { resetAt } = await ensureReset(redis);
  const score = [
    tag,
    String(payload?.countryCode || "").toUpperCase(),
    duration,
  ];
  const current = await getList(redis, LEADERBOARD_KEY);
  const next = [...current, score]
    .sort((a, b) => a[2] - b[2])
    .slice(0, MAX_LEADERBOARD);
  await setList(redis, LEADERBOARD_KEY, next);

  return {
    type: "circuitUpdate",
    circuitLeaderboard: next,
    circuitResetTime: resetAt,
  };
}

export async function insertCataclysm() {
  const redis = getRedis();
  let count = 0;
  if (redis) {
    count = toNumber(await redis.incr(CATACLYSM_COUNT_KEY), 0);
  }
  const cataclysmProgress = Math.min(1, (count % 100) / 100);
  return {
    type: "cataclysmUpdate",
    cataclysmCount: count,
    cataclysmProgress,
  };
}
