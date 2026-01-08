import "./globals.css";

export const metadata = {
  title: "cubixles_",
  description:
    "Mint cubixles_: NFTs linked to interactive p5.js artwork whose provenance is tethered to NFTs you already own.",
  icons: {
    icon: "/assets/icon.png",
  },
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
        imageUrl: `${baseUrl}/assets/ogimage.png`,
        button: {
          title: "Launch cubixles_",
          action: {
            type: "launch_frame",
            name: "mint a cubixle__",
            url: baseUrl,
          },
        },
        splashImageUrl: `${baseUrl}/assets/splash.png`,
        splashBackgroundColor: "#000000",
      }
    : null;
  const miniappDefinition = baseUrl
    ? {
        version: "1",
        name: "cubixles_",
        iconUrl: `${baseUrl}/assets/icon.png`,
        homeUrl: baseUrl,
        imageUrl: `${baseUrl}/assets/image.png`,
        buttonTitle: "mint cube(less)",
        splashImageUrl: `${baseUrl}/assets/splash.png`,
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
