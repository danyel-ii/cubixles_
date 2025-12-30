import { readEnvNumber } from "./env.js";

const mintTimestamps = [];
const failureTimestamps = [];
const lastAlertAt = new Map();

function nowMs() {
  return Date.now();
}

function prune(list, windowMs, now) {
  while (list.length && list[0] <= now - windowMs) {
    list.shift();
  }
}

function shouldAlert(name, now) {
  const cooldownMs = readEnvNumber("ALERT_COOLDOWN_MS", 10 * 60_000);
  const last = lastAlertAt.get(name) || 0;
  if (now - last < cooldownMs) {
    return false;
  }
  lastAlertAt.set(name, now);
  return true;
}

async function emitAlert(payload) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[alert]", payload);
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("[alert] delivery failed", error?.message || error);
  }
}

export async function recordMintAttempt() {
  const now = nowMs();
  const windowMs = readEnvNumber("MINT_SPIKE_WINDOW_MS", 60_000);
  const threshold = readEnvNumber("MINT_SPIKE_THRESHOLD", 20);
  mintTimestamps.push(now);
  prune(mintTimestamps, windowMs, now);
  if (mintTimestamps.length >= threshold && shouldAlert("mint.spike", now)) {
    await emitAlert({
      event: "mint.spike",
      count: mintTimestamps.length,
      windowMs,
    });
  }
}

export async function recordPinFailure(context) {
  const now = nowMs();
  const windowMs = readEnvNumber("PIN_FAILURE_WINDOW_MS", 60_000);
  const threshold = readEnvNumber("PIN_FAILURE_THRESHOLD", 5);
  failureTimestamps.push(now);
  prune(failureTimestamps, windowMs, now);
  if (failureTimestamps.length >= threshold && shouldAlert("pin.failure", now)) {
    await emitAlert({
      event: "pin.failure",
      count: failureTimestamps.length,
      windowMs,
      context,
    });
  }
}
