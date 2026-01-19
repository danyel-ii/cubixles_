import { notFound } from "next/navigation";

import TokenViewerPage, {
  buildTokenViewerMetadata,
} from "../../[tokenId]/page";
import { decodeBase62ToTokenId } from "../../../_lib/shortToken";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { short: string };
}) {
  const tokenId = decodeBase62ToTokenId(params.short);
  if (!tokenId) {
    return {};
  }
  return buildTokenViewerMetadata(tokenId, params.short);
}

export default async function ShortTokenViewerPage({
  params,
}: {
  params: { short: string };
}) {
  const tokenId = decodeBase62ToTokenId(params.short);
  if (!tokenId) {
    notFound();
  }
  return TokenViewerPage({ params: { tokenId } });
}
