import "./globals.css";

export const metadata = {
  title: "cubixles_",
  description:
    "Mint interactive p5.js artworks whose provenance is tethered to NFTs you already own.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head />
      <body>
        {children}
      </body>
    </html>
  );
}
