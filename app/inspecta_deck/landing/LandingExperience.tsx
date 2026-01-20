import Link from "next/link";
import LandingCubeIcon from "../_components/LandingCubeIcon";
import CubixlesLogo from "../_components/CubixlesLogo";
import LandingLoaderOverlay from "../_components/LandingLoaderOverlay";
import TokenIndexPanel from "../_components/TokenIndexPanel";
import DigItOverlay from "../_components/DigItOverlay";
import PaletteRandomizer from "../_components/PaletteRandomizer";

const RAW_CHAIN_ID = Number.parseInt(
  process.env.CUBIXLES_CHAIN_ID ?? process.env.BASE_CHAIN_ID ?? "1",
  10
);
const DEFAULT_CHAIN_ID = Number.isFinite(RAW_CHAIN_ID) ? RAW_CHAIN_ID : 1;
const LANDING_CHAIN_ID = DEFAULT_CHAIN_ID === 8453 ? 8453 : 1;

export default function LandingExperience() {
  return (
    <main className="landing-page landing-home">
      <PaletteRandomizer />
      <LandingLoaderOverlay />
      <section className="landing-header">
        <div className="landing-intro">
          <h1 className="landing-title">
            <a href="/" className="cubixles-logo-link">
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
              href="/"
              className="landing-button platinum"
              target="_blank"
              rel="noreferrer"
            >
              Bootleg a cube
            </a>
            <DigItOverlay />
          </div>
        </div>
        <LandingCubeIcon />
      </section>

      <section id="token-list" className="landing-token-list">
        <TokenIndexPanel defaultChainId={LANDING_CHAIN_ID} />
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
