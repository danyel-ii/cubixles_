import { ImageResponse } from "next/og";
import { Interface } from "ethers";
import deployment from "../../../contracts/deployments/mainnet.json";
import abi from "../../../contracts/abi/CubixlesMinter.json";
import { buildGatewayUrls } from "../../../src/shared/ipfs-fetch.js";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DEFAULT_DESCRIPTION =
  "Mint cubixles_: NFTs linked to interactive p5.js artwork whose provenance is tethered to NFTs you already own.";
const DEFAULT_IMAGE_PATH = "/assets/ogimage.png";
const SHARE_TITLE = "remixed and cubed nft mints";

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

export default async function OpenGraphImage({ params }) {
  const tokenId = params?.tokenId ? String(params.tokenId) : "";
  const baseUrl = getBaseUrl();
  const fallbackImage = baseUrl
    ? new URL(DEFAULT_IMAGE_PATH, baseUrl).toString()
    : DEFAULT_IMAGE_PATH;
  let title = SHARE_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let imageUrl = fallbackImage;

  try {
    const metadata = await fetchTokenMetadata(tokenId);
    void metadata?.name;
    if (metadata?.description) {
      description = metadata.description;
    }
    const resolvedImage = resolveImageUrl(metadata?.image, baseUrl);
    if (resolvedImage) {
      imageUrl = resolvedImage;
    }
  } catch (error) {
    void error;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at top, rgba(64, 71, 95, 0.6), rgba(8, 10, 16, 1))",
          color: "#f2f4ff",
          fontFamily: "Arial, sans-serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            width: "52%",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              color: "rgba(255, 78, 186, 0.85)",
            }}
          >
            cubixles_
          </div>
          <div style={{ fontSize: "48px", fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: "22px", color: "rgba(230, 233, 239, 0.75)" }}>
            {description}
          </div>
          <div style={{ fontSize: "18px", color: "rgba(130, 240, 220, 0.9)" }}>
            Token view · Ethereum Mainnet
          </div>
        </div>
        <div
          style={{
            width: "44%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: "28px",
              overflow: "hidden",
              background: "rgba(20, 24, 36, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={imageUrl}
              alt={title}
              width="480"
              height="480"
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
