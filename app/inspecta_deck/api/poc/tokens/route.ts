import { NextResponse } from "next/server";

import { getEnvConfig } from "../../../_lib/env";
import { getTrustedClientIp } from "../../../_lib/request";
import { checkTokenBucket, getReadRateLimitConfig } from "../../../_lib/rateLimit";
import {
  getAllNftsForCollection,
  getNftsForCollection,
} from "../../../_lib/alchemy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
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

    const url = new URL(request.url);
    const { searchParams } = url;
    const chainIdParam = searchParams.get("chainId");
    const chainIdRaw = chainIdParam ? Number.parseInt(chainIdParam, 10) : NaN;
    const chainId = Number.isFinite(chainIdRaw) ? chainIdRaw : undefined;
    const { network, contractAddress } = getEnvConfig(chainId);
    const limitParam = searchParams.get("limit");
    const pageKeyParam = searchParams.get("pageKey");
    const allParam = searchParams.get("all");
    const maxPagesParam = searchParams.get("maxPages");
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 20;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 20;
    const all = allParam === "1" || allParam === "true";
    const parsedMaxPages = maxPagesParam
      ? Number.parseInt(maxPagesParam, 10)
      : 10;
    const maxPages = Number.isFinite(parsedMaxPages) ? parsedMaxPages : 10;

    const pageKey =
      pageKeyParam && pageKeyParam.trim().length > 0 ? pageKeyParam : undefined;
    const result = all
      ? await getAllNftsForCollection({ pageSize: limit, maxPages, chainId })
      : await getNftsForCollection(limit, pageKey, chainId);

    return NextResponse.json({
      network,
      contractAddress,
      count: result.tokens.length,
      tokens: result.tokens,
      pageKey: result.pageKey ?? null,
      nextToken: result.pageKey ?? null,
      pages: "pages" in result ? result.pages : 1,
      truncated: "truncated" in result ? result.truncated : false,
      mode: all ? "all" : "page",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "token_list_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
