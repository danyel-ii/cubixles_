import { headers } from "next/headers";
import LandingExperience from "./landing/LandingExperience";
import { getBasePath } from "./_lib/basePath";

export const dynamic = "force-dynamic";

const TITLE = "cubixles_ — Provenance as building blocks";
const DESCRIPTION =
  "Provenance as building blocks, NFTs as materials, and citations as structure.";

function getBaseUrl() {
  const normalizedBasePath = getBasePath();
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
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

function buildAbsoluteUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function generateMetadata() {
  const baseUrl = getBaseUrl();
  const ogImage = buildAbsoluteUrl(baseUrl, "/ogImage.png");
  const pageUrl = buildAbsoluteUrl(baseUrl, "/");

  return {
    title: TITLE,
    description: DESCRIPTION,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: pageUrl,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: [ogImage],
    },
  };
}

export default function HomePage() {
  return <LandingExperience />;
}
