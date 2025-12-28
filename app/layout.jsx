import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "cubeless",
  description:
    "Mint interactive p5.js artworks whose provenance is tethered to NFTs you already own.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head />
      <body>
        <Script
          id="p5-lib"
          src="https://cdn.jsdelivr.net/npm/p5@1.9.2/lib/p5.min.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
