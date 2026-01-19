import Link from "next/link";
import { headers } from "next/headers";

import CubeProvenanceExplorer from "../../_components/CubeProvenanceExplorer";
import MintAuditPanel from "../../_components/MintAuditPanel";
import { getLiveMintedCube } from "../../_lib/mintedCubeService";
import { getBasePath, withBasePath } from "../../_lib/basePath";
import { CUBIXLES_MINTED_CUBES } from "../../_data/minted-cube";
import { MINT_AUDIT } from "../../_data/mint-audit";

const fallbackCube = CUBIXLES_MINTED_CUBES[MINT_AUDIT.tokenId];
const TOKEN_VIEWER_PREVIEW_DESCRIPTION =
  "cubixles_ let you mint nft's whose provenance tethers to artwork you already own";
const TOKEN_VIEWER_PREVIEW_IMAGE = withBasePath("/assets/deadcatmod.jpg");

export const dynamic = "force-dynamic";

function getBaseUrl() {
  const normalizedBasePath = getBasePath();
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${proto}://${host}${normalizedBasePath}`;
  }
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl) {
    const normalizedEnv = envUrl.replace(/\/$/, "");
    return normalizedEnv.endsWith(normalizedBasePath)
      ? normalizedEnv
      : `${normalizedEnv}${normalizedBasePath}`;
  }
  return `http://localhost:3000${normalizedBasePath}`;
}

function buildViewerUrl(baseUrl: string, tokenId: string, shortSlug?: string) {
  const path = shortSlug ? `/m/t/${shortSlug}` : `/m/${tokenId}`;
  return new URL(withBasePath(path), baseUrl).toString();
}

export async function buildTokenViewerMetadata(
  tokenId: string,
  shortSlug?: string
) {
  const cube = (await getLiveMintedCube(tokenId)) ?? fallbackCube;
  const baseUrl = getBaseUrl();
  const canonicalUrl = buildViewerUrl(baseUrl, tokenId, shortSlug);
  const openGraphImages = [
    {
      url: TOKEN_VIEWER_PREVIEW_IMAGE,
      width: 1024,
      height: 1024,
    },
  ];

  return {
    title: `cubixles_ — Token ${cube.tokenId} audit`,
    description: TOKEN_VIEWER_PREVIEW_DESCRIPTION,
    openGraph: {
      title: `cubixles_ — Token ${cube.tokenId} audit`,
      description: TOKEN_VIEWER_PREVIEW_DESCRIPTION,
      url: canonicalUrl,
      images: openGraphImages,
    },
    twitter: {
      card: "summary_large_image",
      title: `cubixles_ — Token ${cube.tokenId} audit`,
      description: TOKEN_VIEWER_PREVIEW_DESCRIPTION,
      images: [TOKEN_VIEWER_PREVIEW_IMAGE],
    },
    metadataBase: new URL(baseUrl),
  };
}

export async function generateMetadata({
  params,
}: {
  params: { tokenId: string };
}) {
  return buildTokenViewerMetadata(params.tokenId);
}

export default async function TokenPlaceholder({
  params,
}: {
  params: { tokenId: string };
}) {
  const cube = (await getLiveMintedCube(params.tokenId)) ?? fallbackCube;

  return (
    <main className="landing-page">
      <MintAuditPanel focusTokenId={params.tokenId} />
      <CubeProvenanceExplorer cube={cube} requestedTokenId={params.tokenId} />
      <div className="landing-ctas token-landing-ctas">
        <Link href={withBasePath("/landing")} className="landing-button secondary">
          Return to provenance cube
        </Link>
      </div>
    </main>
  );
}
