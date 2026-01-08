import { NextResponse } from "next/server";
import { issueNonce } from "../../../src/server/auth.js";
import { checkRateLimit } from "../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../src/server/request.js";
import { logRequest } from "../../../src/server/log.js";

export async function GET(request) {
  const requestId = makeRequestId();
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`nonce:${ip}`, {
    capacity: 10,
    refillPerSec: 1,
  });
  if (!limit.ok) {
    logRequest({ route: "/api/nonce", status: 429, requestId, bodySize: 0 });
    return NextResponse.json(
      { error: "Rate limit exceeded", requestId },
      { status: 429 }
    );
  }

  const { nonce, expiresAt } = issueNonce();
  const response = NextResponse.json({ nonce, expiresAt, requestId });
  response.headers.set("Cache-Control", "no-store");
  logRequest({ route: "/api/nonce", status: 200, requestId, bodySize: 0 });
  return response;
}
