import Link from "next/link";
import LandingCubeIcon from "../_components/LandingCubeIcon";
import CubixlesLogo from "../_components/CubixlesLogo";
import NotesFlockOverlay from "../_components/NotesFlockOverlay";
import TokenIndexPanel from "../_components/TokenIndexPanel";
import DigItOverlay from "../_components/DigItOverlay";
import PaletteRandomizer from "../_components/PaletteRandomizer";

export default function LandingExperience() {
  return (
    <main className="landing-page landing-home">
      <PaletteRandomizer />
      <NotesFlockOverlay />
      <section className="landing-header">
        <div className="landing-intro">
          <h1 className="landing-title">
            <a href="https://www.cubixles.xyz" className="cubixles-logo-link">
              <CubixlesLogo />
            </a>
          </h1>
          <p className="landing-subhead">
            Provenance as building blocks, NFTs as materials, and citations as
            structure.
          </p>
          <div className="landing-ctas">
            <Link href="#token-list" className="landing-button primary">
              Browse token list
            </Link>
            <a
              href="https://www.cubixles.xyz"
              className="landing-button platinum"
              target="_blank"
              rel="noreferrer"
            >
              Mint your own
            </a>
            <DigItOverlay />
          </div>
        </div>
        <LandingCubeIcon />
      </section>

      <section id="token-list" className="landing-token-list">
        <TokenIndexPanel />
      </section>

      <footer className="landing-watermark">
        hat&apos;s off to{" "}
        <a
          href="https://www.paypal.com/paypalme/Ballabani"
          target="_blank"
          rel="noreferrer"
        >
          https://marjoballabani.me/
        </a>
      </footer>
    </main>
  );
}
