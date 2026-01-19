import "./globals.css";
import AssetPrefixCheck from "./_components/AssetPrefixCheck";
import FloatingDiamonds from "./_components/FloatingDiamonds";
import { cubixlesLogoFont } from "./_lib/fonts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "cubixles_ — Provenance as Composition",
  description:
    "Provenance here is not who owned what — it’s what made what possible.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={cubixlesLogoFont.variable}>
        <AssetPrefixCheck />
        <FloatingDiamonds />
        {children}
      </body>
    </html>
  );
}
