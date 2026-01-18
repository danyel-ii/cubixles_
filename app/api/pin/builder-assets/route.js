import { NextResponse } from "next/server";

import { checkRateLimit } from "../../../../src/server/ratelimit.js";
import { getClientIp, makeRequestId } from "../../../../src/server/request.js";
import { logRequest } from "../../../../src/server/log.js";
import {
  builderAssetRequestSchema,
  readJsonWithLimit,
  formatZodError,
} from "../../../../src/server/validate.js";
import { verifyNonce, verifySignature } from "../../../../src/server/auth.js";
import { generateQrBuffer, renderBuilderCard } from "../../../../src/server/builder-assets.js";
import {
  DEFAULT_PAPERCLIP_SIZE,
  normalizePaperclipPalette,
  renderPaperclipBuffer,
} from "../../../../src/server/paperclip.js";
import { hashPayload, getCachedCid, setCachedCid, pinFile } from "../../../../src/server/pinata.js";
import { recordMetric } from "../../../../src/server/metrics.js";
import { readEnvBool } from "../../../../src/server/env.js";

const MAX_BYTES = 12 * 1024;

export const runtime = "nodejs";

export async function POST(request) {
  const requestId = makeRequestId();
  let bodySize = 0;
  const ip = getClientIp(request);

  if (readEnvBool("DISABLE_PINNING", false) || readEnvBool("DISABLE_MINTING", false)) {
    recordMetric("mint.pin.assets.blocked");
    logRequest({ route: "/api/pin/builder-assets", status: 503, requestId, bodySize });
    return NextResponse.json(
      { error: "Asset pinning is temporarily disabled", requestId },
      { status: 503 }
    );
  }

  const ipLimit = await checkRateLimit(`pin-assets:ip:${ip}`, {
    capacity: 5,
    refillPerSec: 0.5,
  });
  if (!ipLimit.ok) {
    logRequest({ route: "/api/pin/builder-assets", status: 429, requestId, bodySize });
    return NextResponse.json({ error: "Rate limit exceeded", requestId }, { status: 429 });
  }

  try {
    recordMetric("mint.pin.assets.attempt");
    const { data, size } = await readJsonWithLimit(request, MAX_BYTES);
    bodySize = size;
    const parsed = builderAssetRequestSchema.safeParse(data);
    if (!parsed.success) {
      recordMetric("mint.pin.assets.validation_failed");
      return NextResponse.json(
        { error: formatZodError(parsed.error), requestId },
        { status: 400 }
      );
    }

    const { address, nonce, signature, payload, chainId } = parsed.data;
    const viewerUrl = payload.viewerUrl;
    const tokenId = String(payload.tokenId);

    const nonceStatus = await verifyNonce(nonce);
    if (!nonceStatus.ok) {
      recordMetric("mint.pin.assets.nonce_failed");
      return NextResponse.json(
        { error: nonceStatus.error || "Invalid nonce", requestId },
        { status: 401 }
      );
    }

    const sigStatus = await verifySignature({ address, nonce, signature, chainId });
    if (!sigStatus.ok) {
      recordMetric("mint.pin.assets.signature_failed");
      return NextResponse.json(
        { error: sigStatus.error || "Invalid signature", requestId },
        { status: 401 }
      );
    }

    const resolvedChainId = Number.isFinite(chainId) ? Number(chainId) : undefined;

    const qrHash = hashPayload(`builder-qr:${viewerUrl}`);
    let qrCid = await getCachedCid(qrHash);
    let qrBuffer = null;
    if (!qrCid) {
      qrBuffer = await generateQrBuffer(viewerUrl);
      qrCid = await pinFile(qrBuffer, {
        name: `cubixles_${tokenId}_qr.png`,
        mimeType: "image/png",
        keyvalues: {
          kind: "builder_qr",
          chainId: resolvedChainId,
          tokenId,
          viewerUrl,
        },
      });
      if (!qrCid) {
        throw new Error("QR pinning failed.");
      }
      await setCachedCid(qrHash, qrCid);
    }

    if (!qrBuffer) {
      qrBuffer = await generateQrBuffer(viewerUrl);
    }

    const cardHash = hashPayload(`builder-card:${viewerUrl}:${qrCid}`);
    let cardCid = await getCachedCid(cardHash);
    if (!cardCid) {
      const cardBuffer = await renderBuilderCard({ qrBuffer });
      cardCid = await pinFile(cardBuffer, {
        name: `cubixles_${tokenId}_card.png`,
        mimeType: "image/png",
        keyvalues: {
          kind: "builder_card",
          chainId: resolvedChainId,
          tokenId,
          viewerUrl,
          qrCid,
        },
      });
      if (!cardCid) {
        throw new Error("Card pinning failed.");
      }
      await setCachedCid(cardHash, cardCid);
    }

    let paperclipCid = null;
    let paperclipUrl = null;
    if (payload.paperclip?.seed) {
      const seed = String(payload.paperclip.seed || "").trim();
      if (!seed) {
        throw new Error("Paperclip seed missing.");
      }
      const palette = normalizePaperclipPalette(payload.paperclip.palette);
      const size = Number(payload.paperclip.size) || DEFAULT_PAPERCLIP_SIZE;
      const paletteKey = palette.length ? palette.join(",") : "fallback";
      const clipHash = hashPayload(`builder-paperclip:${seed}:${paletteKey}:${size}`);
      paperclipCid = await getCachedCid(clipHash);
      if (!paperclipCid) {
        const clipBuffer = renderPaperclipBuffer({ seed, palette, size });
        paperclipCid = await pinFile(clipBuffer, {
          name: `cubixles_${tokenId}_paperclip.png`,
          mimeType: "image/png",
          keyvalues: {
            kind: "builder_paperclip",
            chainId: resolvedChainId,
            tokenId,
            seed,
            palette: paletteKey,
          },
        });
        if (!paperclipCid) {
          throw new Error("Paperclip pinning failed.");
        }
        await setCachedCid(clipHash, paperclipCid);
      }
      paperclipUrl = `ipfs://${paperclipCid}`;
    }

    const responsePayload = {
      qrCid,
      qrUrl: `ipfs://${qrCid}`,
      cardCid,
      cardUrl: `ipfs://${cardCid}`,
      paperclipCid,
      paperclipUrl,
      requestId,
    };

    recordMetric("mint.pin.assets.success");
    logRequest({
      route: "/api/pin/builder-assets",
      status: 200,
      requestId,
      bodySize,
    });
    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    const status = error?.status || 500;
    recordMetric("mint.pin.assets.failed");
    logRequest({ route: "/api/pin/builder-assets", status, requestId, bodySize });
    return NextResponse.json(
      { error: error?.message || "Asset pin request failed", requestId },
      { status }
    );
  }
}
