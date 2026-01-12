import { Redis } from "@upstash/redis";

let client = null;

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
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

export function getRedis() {
  if (!hasRedis()) {
    return null;
  }
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return client;
}
