import "./inspecta-deck.css";
import { cubixlesLogoFont } from "./_lib/fonts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "cubixles_ — Provenance as Composition",
  description:
    "Provenance here is not who owned what — it’s what made what possible.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`inspecta-deck-root ${cubixlesLogoFont.variable}`}>
      {children}
    </div>
  );
}
