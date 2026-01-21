import { headers } from "next/headers";
import { DeckPage } from "./DeckPage.jsx";

export const dynamic = "force-dynamic";

const DEFAULT_CHAIN_ID = 1;
const DEFAULT_PAGE_SIZE = 8;

async function fetchInitialTokenList() {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "http://localhost:3000";
  const params = new URLSearchParams({
    limit: String(DEFAULT_PAGE_SIZE),
    chainId: String(DEFAULT_CHAIN_ID),
  });
  const forwardHeaders = {};
  const cookieHeader = headerList.get("cookie");
  const bypassHeader = headerList.get("x-vercel-protection-bypass");
  if (cookieHeader) {
    forwardHeaders.cookie = cookieHeader;
  }
  if (bypassHeader) {
    forwardHeaders["x-vercel-protection-bypass"] = bypassHeader;
  }
  try {
    const response = await fetch(
      `${baseUrl}/api/poc/tokens?${params.toString()}`,
      {
        cache: "no-store",
        headers: forwardHeaders,
      }
    );
    const payload = response.ok ? await response.json() : null;
    if (!response.ok) {
      return {
        tokens: [],
        pageKey: null,
        pages: 1,
        truncated: false,
        error: payload?.error || `Token list request failed (${response.status}).`,
      };
    }
    return payload || { tokens: [], pageKey: null, pages: 1, truncated: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { tokens: [], pageKey: null, pages: 1, truncated: false, error: message };
  }
}

export default async function ShaolinDeckPage() {
  const initialTokenList = await fetchInitialTokenList();
  return <DeckPage initialTokenList={initialTokenList} />;
}
