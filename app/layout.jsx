import "./globals.css";

export const metadata = {
  title: "cubeless",
  description:
    "Mint interactive p5.js artworks whose provenance is tethered to NFTs you already own.",
};

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

export default function RootLayout({ children }) {
  const baseUrl = getBaseUrl();
  const frameDefinition = baseUrl
    ? {
        version: "next",
        imageUrl: `${baseUrl}/ogImage.png`,
        button: {
          title: "Launch cubeless",
          action: {
            type: "launch_frame",
            url: baseUrl,
          },
        },
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#000000",
      }
    : null;
  const miniappDefinition = baseUrl
    ? {
        version: "1",
        name: "cubeless",
        iconUrl: `${baseUrl}/icon.png`,
        homeUrl: baseUrl,
        imageUrl: `${baseUrl}/image.png`,
        buttonTitle: "mint cube(less)",
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: "#000000",
      }
    : null;

  return (
    <html lang="en">
      <head>
        {frameDefinition ? (
          <meta
            property="fc:frame"
            content={JSON.stringify(frameDefinition)}
          />
        ) : null}
        {miniappDefinition ? (
          <meta
            property="fc:miniapp"
            content={JSON.stringify(miniappDefinition)}
          />
        ) : null}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
