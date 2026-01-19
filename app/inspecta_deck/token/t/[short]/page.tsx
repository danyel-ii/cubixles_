import { notFound } from "next/navigation";

import TokenInspectorPage, {
  buildTokenInspectorMetadata,
} from "../../[id]/page";
import { decodeBase62ToTokenId } from "../../../_lib/shortToken";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { short: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tokenId = decodeBase62ToTokenId(params.short);
  if (!tokenId) {
    return {};
  }
  return buildTokenInspectorMetadata({
    tokenId,
    searchParams,
    shortSlug: params.short,
  });
}

export default async function ShortTokenInspectorPage({
  params,
  searchParams,
}: {
  params: { short: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tokenId = decodeBase62ToTokenId(params.short);
  if (!tokenId) {
    notFound();
  }
  return TokenInspectorPage({ params: { id: tokenId }, searchParams });
}
