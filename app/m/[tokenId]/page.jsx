import { Interface } from "ethers";
import AppShell from "../../ui/AppShell.jsx";
import deployment from "../../../contracts/deployments/mainnet.json";
import abi from "../../../contracts/abi/CubixlesMinter.json";
import { buildGatewayUrls } from "../../../src/shared/ipfs-fetch.js";

const DEFAULT_DESCRIPTION = "cubixles_ and curtains";
const SHARE_TITLE = "remixed and cubed nft mints";
const DEFAULT_IMAGE_PATH = "/assets/deadcatmod.jpg";

export const dynamic = "force-dynamic";

function resolveImageUrl(imageUrl, baseUrl) {
  if (!imageUrl) {
    return null;
  }
  if (imageUrl.startsWith("ipfs://")) {
    return buildGatewayUrls(imageUrl)[0];
  }
  if (
    imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("data:")
  ) {
    return imageUrl;
  }
  return new URL(imageUrl, baseUrl).toString();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

async function fetchTokenUri(tokenId) {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey || !tokenId) {
    return null;
  }
  const chainId = deployment.chainId || 1;
  const rpcUrl =
    chainId === 1
      ? `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`
      : chainId === 11155111
      ? `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`
      : null;
  if (!rpcUrl) {
    return null;
  }
  const iface = new Interface(abi);
  const data = iface.encodeFunctionData("tokenURI", [BigInt(tokenId)]);
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: deployment.address, data }, "latest"],
  };
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const json = await response.json();
  const result = json?.result;
  if (!result) {
    return null;
  }
  const decoded = iface.decodeFunctionResult("tokenURI", result);
  return decoded?.[0] ?? null;
}

async function fetchTokenMetadata(tokenId) {
  const tokenUri = await fetchTokenUri(tokenId);
  if (!tokenUri) {
    return null;
  }
  if (tokenUri.startsWith("ipfs://")) {
    const urls = buildGatewayUrls(tokenUri);
    for (const url of urls) {
      const json = await fetchJson(url);
      if (json) {
        return json;
      }
    }
    return null;
  }
  return fetchJson(tokenUri);
}

export async function generateMetadata({ params }) {
  const tokenId = params?.tokenId ? String(params.tokenId) : "";
  const baseUrl = getBaseUrl();
  const fallbackImage = baseUrl
    ? new URL(DEFAULT_IMAGE_PATH, baseUrl).toString()
    : DEFAULT_IMAGE_PATH;
  let title = tokenId ? `cubixles_ #${tokenId}` : "cubixles_ token";
  let description = DEFAULT_DESCRIPTION;
  const ogRoute = tokenId
    ? `/m/${encodeURIComponent(tokenId)}/opengraph-image`
    : fallbackImage;
  const ogImage = baseUrl ? new URL(ogRoute, baseUrl).toString() : ogRoute;

  try {
    const metadata = await fetchTokenMetadata(tokenId);
    if (metadata?.name) {
      title = metadata.name;
    }
    if (metadata?.description) {
      description = metadata.description;
    }
    void resolveImageUrl(metadata?.image, baseUrl);
  } catch (error) {
    void error;
  }

  return {
    ...(baseUrl ? { metadataBase: new URL(baseUrl) } : {}),
    title,
    description,
    openGraph: {
      title: SHARE_TITLE,
      description,
      type: "website",
      url: baseUrl ? `${baseUrl}/m/${tokenId}` : `/m/${tokenId}`,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: SHARE_TITLE,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

function getBaseUrl() {
  const raw = (
    process.env.NEXT_PUBLIC_TOKEN_VIEW_BASE_URL ||
    process.env.VERCEL_URL ||
    ""
  ).trim();
  if (!raw) {
    return "";
  }
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return normalized.replace(/\/$/, "");
}

export default function TokenViewPage() {
  return <AppShell />;
}
