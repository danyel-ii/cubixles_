export function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

export function readEnvBool(name, fallback = false) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(normalized);
}

export function readEnvNumber(name, fallback) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}
