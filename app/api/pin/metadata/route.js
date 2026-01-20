import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../../src/server/request.js";
import { logRequest } from "../../../../src/server/log.js";
import { pinRequestSchema, readJsonWithLimit, formatZodError } from "../../../../src/server/validate.js";
import { metadataSchema, extractRefs } from "../../../../src/shared/schemas/metadata.js";
import { canonicalJson } from "../../../../src/server/json.js";
import { generateCubeGif } from "../../../../src/server/cube-gif.js";
import { hashPayload, getCachedCid, setCachedCid, pinJson, pinFile } from "../../../../src/server/pinata.js";
import { recordPinLog } from "../../../../src/server/pin-log.js";
import { verifyNonce, verifySignature } from "../../../../src/server/auth.js";
import { recordMetric } from "../../../../src/server/metrics.js";
import { readEnvBool } from "../../../../src/server/env.js";
import { recordMintAttempt, recordPinFailure } from "../../../../src/server/alerts.js";
import { enforceOriginAllowlist } from "../../../../src/server/origin.js";

const MAX_BYTES = 50 * 1024;

export const runtime = "nodejs";

export async function POST(request) {
  const requestId = makeRequestId();
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

  const originCheck = enforceOriginAllowlist(request);
  if (!originCheck.ok) {
    logRequest({ route: "/api/pin/metadata", status: originCheck.status, requestId, bodySize });
    return NextResponse.json(
      { error: originCheck.error || "Origin not allowed", requestId },
      { status: originCheck.status }
    );
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

    const { address, nonce, signature, payload, chainId } = parsed.data;
    const nonceStatus = await verifyNonce(nonce);
    if (!nonceStatus.ok) {
      recordMetric("mint.pin.nonce_failed");
      return NextResponse.json(
        { error: nonceStatus.error || "Invalid nonce", requestId },
        { status: 401 }
      );
    }

    const payloadChainId = payload?.provenance?.chainId;
    if (
      Number.isFinite(payloadChainId) &&
      Number.isFinite(chainId) &&
      Number(payloadChainId) !== Number(chainId)
    ) {
      recordMetric("mint.pin.chain_mismatch");
      return NextResponse.json(
        { error: "Pin request chain mismatch", requestId },
        { status: 400 }
      );
    }
    const resolvedChainId = Number.isFinite(payloadChainId)
      ? Number(payloadChainId)
      : Number.isFinite(chainId)
        ? Number(chainId)
        : undefined;

    const sigStatus = await verifySignature({ address, nonce, signature, chainId });
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

    let finalPayload = payload;
    const tokenId = payload?.tokenId ? String(payload.tokenId) : null;
    const paletteColors = Array.isArray(payload?.palette?.hex_colors)
      ? payload.palette.hex_colors
      : Array.isArray(payload?.palette?.used_hex_colors)
        ? payload.palette.used_hex_colors
        : [];
    if (paletteColors.length >= 3 && tokenId) {
      try {
        const gifBuffer = await generateCubeGif({ colors: paletteColors });
        const gifName = `cubixles_${tokenId}.gif`;
        const gifCid = await pinFile(gifBuffer, {
          name: gifName,
          keyvalues: {
            kind: "preview_gif",
            chainId: resolvedChainId,
            tokenId,
          },
        });
        if (gifCid) {
          finalPayload = {
            ...payload,
            preview_gif: `ipfs://${gifCid}`,
          };
        }
      } catch (error) {
        recordMetric("mint.pin.gif_failed");
      }
    }

    const payloadText = canonicalJson(finalPayload);
    const payloadHash = hashPayload(payloadText);
    const metadataHash = `0x${payloadHash}`;
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
      await recordPinLog({
        cid: cachedCid,
        tokenURI,
        metadataHash,
        payloadHash,
        chainId: resolvedChainId,
        tokenId,
        minter: actor,
        cached: true,
        requestId,
      });
      return NextResponse.json(
        { cid: cachedCid, tokenURI, metadataHash, cached: true, requestId },
        { status: 200 }
      );
    }

    const name = tokenId ? `cubixles_${tokenId}.json` : "cubixles_metadata.json";
    const cid = await pinJson(payloadText, {
      name,
      keyvalues: {
        kind: "metadata",
        chainId: resolvedChainId,
        tokenId,
        metadataHash,
        payloadHash,
        minter: actor,
      },
    });
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
    await recordPinLog({
      cid,
      tokenURI,
      metadataHash,
      payloadHash,
      chainId: resolvedChainId,
      tokenId,
      minter: actor,
      cached: false,
      requestId,
    });
    recordMetric("mint.pin.success");
    logRequest({
      route: "/api/pin/metadata",
      status: 200,
      requestId,
      bodySize,
      payloadHash,
      actor,
    });
    return NextResponse.json({ cid, tokenURI, metadataHash, requestId }, { status: 200 });
  } catch (error) {
    const status = error?.status || 500;
    recordMetric("mint.pin.failed");
    await recordPinFailure({ reason: error?.message || "unknown" });
    console.error("[pin/metadata] failed", {
      requestId,
      status,
      message: error?.message,
      stack: error?.stack,
    });
    logRequest({ route: "/api/pin/metadata", status, requestId, bodySize });
    return NextResponse.json(
      { error: error?.message || "Pin request failed", requestId },
      { status }
    );
  }
}
