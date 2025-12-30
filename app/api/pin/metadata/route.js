import crypto from "crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../src/server/ratelimit.js";
import { getClientIp } from "../../../../src/server/request.js";
import { logRequest } from "../../../../src/server/log.js";
import { pinRequestSchema, readJsonWithLimit, formatZodError } from "../../../../src/server/validate.js";
import { metadataSchema, extractRefs } from "../../../../src/shared/schemas/metadata.js";
import { canonicalJson } from "../../../../src/server/json.js";
import { hashPayload, getCachedCid, setCachedCid, pinJson } from "../../../../src/server/pinata.js";
import { verifyNonce, verifySignature } from "../../../../src/server/auth.js";
import { recordMetric } from "../../../../src/server/metrics.js";
import { readEnvBool } from "../../../../src/server/env.js";
import { recordMintAttempt, recordPinFailure } from "../../../../src/server/alerts.js";

const MAX_BYTES = 50 * 1024;

export async function POST(request) {
  const requestId = crypto.randomUUID();
  let bodySize = 0;
  const ip = getClientIp(request);

  if (readEnvBool("DISABLE_PINNING", false) || readEnvBool("DISABLE_MINTING", false)) {
    recordMetric("mint.pin.blocked");
    logRequest({ route: "/api/pin/metadata", status: 503, requestId, bodySize });
    return NextResponse.json(
      { error: "Metadata pinning is temporarily disabled", requestId },
      { status: 503 }
    );
  }

  const ipLimit = await checkRateLimit(`pin:ip:${ip}`, { capacity: 5, refillPerSec: 0.5 });
  if (!ipLimit.ok) {
    logRequest({ route: "/api/pin/metadata", status: 429, requestId, bodySize });
    return NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429 });
  }

  try {
    recordMetric("mint.pin.attempt");
    await recordMintAttempt();
    const { data, size } = await readJsonWithLimit(request, MAX_BYTES);
    bodySize = size;
    const parsed = pinRequestSchema.safeParse(data);
    if (!parsed.success) {
      recordMetric("mint.pin.validation_failed");
      return NextResponse.json(
        { error: formatZodError(parsed.error), requestId },
        { status: 400 }
      );
    }

    const { address, nonce, signature, payload } = parsed.data;
    const nonceStatus = await verifyNonce(nonce);
    if (!nonceStatus.ok) {
      recordMetric("mint.pin.nonce_failed");
      return NextResponse.json(
        { error: nonceStatus.error || "Invalid nonce", requestId },
        { status: 401 }
      );
    }

    const sigStatus = await verifySignature({ address, nonce, signature });
    if (!sigStatus.ok) {
      recordMetric("mint.pin.signature_failed");
      return NextResponse.json(
        { error: sigStatus.error || "Invalid signature", requestId },
        { status: 401 }
      );
    }

    const actor = sigStatus.address;
    const actorLimit = await checkRateLimit(`pin:actor:${actor}`, { capacity: 4, refillPerSec: 0.5 });
    if (!actorLimit.ok) {
      recordMetric("mint.pin.rate_limited");
      return NextResponse.json(
        { error: "Rate limit exceeded", requestId },
        { status: 429 }
      );
    }

    const metadataParsed = metadataSchema.safeParse(payload);
    if (!metadataParsed.success) {
      recordMetric("mint.pin.metadata_invalid");
      return NextResponse.json(
        { error: formatZodError(metadataParsed.error), requestId },
        { status: 400 }
      );
    }

    const refs = extractRefs(metadataParsed.data);
    if (!refs || refs.length === 0) {
      recordMetric("mint.pin.refs_missing");
      return NextResponse.json(
        { error: "Metadata missing provenance refs", requestId },
        { status: 400 }
      );
    }

    if (refs.length > 6) {
      recordMetric("mint.pin.refs_too_many");
      return NextResponse.json(
        { error: "Too many refs", requestId },
        { status: 400 }
      );
    }

    const payloadText = canonicalJson(payload);
    const payloadHash = hashPayload(payloadText);
    const cachedCid = await getCachedCid(payloadHash);
    if (cachedCid) {
      recordMetric("mint.pin.cache_hit");
      const tokenURI = `ipfs://${cachedCid}`;
      logRequest({
        route: "/api/pin/metadata",
        status: 200,
        requestId,
        bodySize,
        payloadHash,
        actor,
      });
      return NextResponse.json(
        { cid: cachedCid, tokenURI, cached: true, requestId },
        { status: 200 }
      );
    }

    const cid = await pinJson(payloadText);
    if (!cid) {
      recordMetric("mint.pin.pinata_missing_cid");
      await recordPinFailure({ reason: "missing_cid" });
      return NextResponse.json(
        { error: "Pinata response missing CID", requestId },
        { status: 502 }
      );
    }
    await setCachedCid(payloadHash, cid);
    const tokenURI = `ipfs://${cid}`;
    recordMetric("mint.pin.success");
    logRequest({
      route: "/api/pin/metadata",
      status: 200,
      requestId,
      bodySize,
      payloadHash,
      actor,
    });
    return NextResponse.json({ cid, tokenURI, requestId }, { status: 200 });
  } catch (error) {
    const status = error?.status || 500;
    recordMetric("mint.pin.failed");
    await recordPinFailure({ reason: error?.message || "unknown" });
    logRequest({ route: "/api/pin/metadata", status, requestId, bodySize });
    return NextResponse.json(
      { error: error?.message || "Pin request failed", requestId },
      { status }
    );
  }
}
