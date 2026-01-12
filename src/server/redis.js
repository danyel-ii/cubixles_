import { Redis } from "@upstash/redis";

let client = null;

function getRedisConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.KV_REDIS_REST_API_URL ||
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.KV_REDIS_REST_API_TOKEN ||
    "";
  return {
    url: url.trim(),
    token: token.trim(),
  };
}

export function getRedisKeyPrefix() {
  const explicit = process.env.REDIS_KEY_PREFIX;
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }
  if (process.env.VERCEL_PROJECT_ID) {
    return process.env.VERCEL_PROJECT_ID;
  }
  if (process.env.VERCEL_GIT_REPO_SLUG) {
    return process.env.VERCEL_GIT_REPO_SLUG;
  }
  return "cubixles";
}

export function buildRedisKey(key) {
  const prefix = getRedisKeyPrefix();
  if (!prefix) {
    return key;
  }
  return `${prefix}:${key}`;
}

export function hasRedis() {
  const { url, token } = getRedisConfig();
  return Boolean(url && token);
}

export function getRedis() {
  if (!hasRedis()) {
    return null;
  }
  if (!client) {
    const { url, token } = getRedisConfig();
    client = new Redis({
      url,
      token,
    });
  }
  return client;
}
