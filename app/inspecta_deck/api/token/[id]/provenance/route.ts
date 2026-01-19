import { NextResponse } from "next/server";

import { getCachedJson } from "../../../../_lib/cache";
import { getEnvConfig } from "../../../../_lib/env";
import { getNftMetadata, getOwnersForToken } from "../../../../_lib/alchemy";
import { normalizeTokenId } from "../../../../_lib/normalize";
import { getTrustedClientIp } from "../../../../_lib/request";
import { checkTokenBucket, getReadRateLimitConfig } from "../../../../_lib/rateLimit";
import {
  resolveMetadata,
  resolveMetadataFromObject,
} from "../../../../_lib/metadata";
import {
  buildOwnerOverlapEvidence,
  buildProvenanceCandidates,
  buildSameTransactionEvidence,
  scanMetadataReferences,
} from "../../../../_lib/provenance";
import { getMintedTokenIdsFromReceipt } from "../../../../_lib/ethers";

// GET /api/token/:id/provenance returns counts, mintTxHash, disclaimer, and other metadata besides candidates.
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const tokenId = normalizeTokenId(params.id);
  if (!tokenId) {
    return NextResponse.json({ error: "invalid_token_id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const chainIdParam = url.searchParams.get("chainId");
  const chainIdRaw = chainIdParam ? Number.parseInt(chainIdParam, 10) : NaN;
  const chainId = Number.isFinite(chainIdRaw) ? chainIdRaw : undefined;

  const { limit: readLimit, windowMs } = getReadRateLimitConfig();
  const clientKey = `read:${new URL(request.url).pathname}:${getTrustedClientIp(
    request
  )}`;
  const rate = await checkTokenBucket(clientKey, readLimit, windowMs);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: rate.resetAt },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rate.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  const { contractAddress, network, cacheTtls } = getEnvConfig(chainId);
  const cacheKey = `provenance:${tokenId}:${chainId ?? "default"}`;

  try {
    const payload = await getCachedJson(cacheKey, cacheTtls.provenance, async () => {
      const token = await getNftMetadata(tokenId, chainId);
      const resolvedMetadata = token.tokenUri?.raw
        ? await resolveMetadata(tokenId, token.tokenUri.raw, cacheTtls.metadata)
        : resolveMetadataFromObject(tokenId, token.metadata);

      const metadataSource = resolvedMetadata.metadata ?? token.metadata;
      const metadataReferences = scanMetadataReferences(metadataSource);

      let sameTransactionReferences = new Map();
      let mintedTokenIds: string[] = [];

      if (token.mint?.transactionHash) {
        mintedTokenIds = await getMintedTokenIdsFromReceipt(
          token.mint.transactionHash,
          chainId
        );
        sameTransactionReferences = buildSameTransactionEvidence(
          token.mint.transactionHash,
          mintedTokenIds,
          tokenId
        );
      }

      const candidateIds = new Set<string>();
      Array.from(metadataReferences.keys()).forEach((id) => candidateIds.add(id));
      Array.from(sameTransactionReferences.keys()).forEach((id) => candidateIds.add(id));

      const targetOwners = await getOwnersForToken(tokenId, chainId);
      const ownerOverlap = new Map();

      await Promise.all(
        Array.from(candidateIds).map(async (candidateId) => {
          if (candidateId === tokenId) {
            return;
          }
          try {
            const candidateOwners = await getOwnersForToken(candidateId, chainId);
            const overlap = buildOwnerOverlapEvidence(targetOwners, candidateOwners);
            if (overlap) {
              ownerOverlap.set(candidateId, overlap);
            }
          } catch {
            // Ignore invalid candidate ids or transient owner lookup failures.
          }
        })
      );

      const candidates = buildProvenanceCandidates({
        targetTokenId: tokenId,
        metadataReferences,
        sameTransactionReferences,
        ownerOverlap,
      });

      // /api/token/:id/provenance returns metadata counts, mintTxHash, disclaimer, and candidates.
      return {
        tokenId,
        contractAddress,
        network,
        mintTxHash: token.mint?.transactionHash ?? null,
        metadataReferenceCount: metadataReferences.size,
        sameTransactionCount: sameTransactionReferences.size,
        ownerOverlapCount: ownerOverlap.size,
        candidates,
        disclaimer:
          "Provenance is heuristic and may be incomplete or incorrect; treat results as inferred evidence, not certainty.",
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "provenance_lookup_failed", detail: message }, { status: 500 });
  }
}
