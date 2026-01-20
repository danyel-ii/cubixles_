import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../../src/server/request.js";
import { logRequest } from "../../../../src/server/log.js";
import { getPinLog } from "../../../../src/server/pin-log.js";

const PIN_LOG_TOKEN =
  process.env.CUBIXLES_PIN_LOG_TOKEN || process.env.PIN_LOG_TOKEN || "";

function getAuthToken(request) {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  const direct = request.headers.get("x-pin-log-token");
  if (direct) {
    return direct.trim();
  }
  const url = new URL(request.url);
  return url.searchParams.get("token")?.trim() || "";
}

export async function GET(request) {
  const requestId = makeRequestId();
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`pinlog:ip:${ip}`, { capacity: 10, refillPerSec: 0.5 });
  if (!limit.ok) {
    logRequest({ route: "/api/pin/log", status: 429, requestId, bodySize: 0 });
    return NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429 });
  }

  if (PIN_LOG_TOKEN) {
    const token = getAuthToken(request);
    if (!token || token !== PIN_LOG_TOKEN) {
      logRequest({ route: "/api/pin/log", status: 401, requestId, bodySize: 0 });
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") || 100);
  const unique = url.searchParams.get("unique") === "true";
  const result = await getPinLog({ limit: rawLimit, unique });
  if (!result.ok) {
    logRequest({ route: "/api/pin/log", status: 503, requestId, bodySize: 0 });
    return NextResponse.json(
      { error: result.error || "Pin log unavailable", requestId },
      { status: 503 }
    );
  }

  logRequest({ route: "/api/pin/log", status: 200, requestId, bodySize: 0 });
  return NextResponse.json({ ...result, requestId }, { status: 200 });
}
