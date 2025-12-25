export function readEnvValue(key) {
  if (typeof process === "undefined") {
    return null;
  }
  const raw = process.env[key];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}
