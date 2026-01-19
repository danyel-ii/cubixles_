"use client";

import Link from "next/link";

import LandingSketch from "./LandingSketch";
import CubixlesLogo from "./CubixlesLogo";
import type { FaceDefinition } from "../_data/landing-provenance";

type LandingHeroProps = {
  onFaceChange: (faceId: FaceDefinition["id"]) => void;
};

export default function LandingHero({ onFaceChange }: LandingHeroProps) {
  return (
    <section className="landing-hero">
      <div className="landing-hero-canvas">
        <LandingSketch onFaceChange={onFaceChange} />
        <div className="landing-hero-overlay">
          <p className="landing-thesis">
            Provenance here is not who owned what — it’s what made what possible.
          </p>
        </div>
      </div>
      <div className="landing-hero-copy">
        <h1 className="landing-title">
          <a href="https://www.cubixles.xyz" className="cubixles-logo-link">
            <CubixlesLogo />
          </a>
        </h1>
        <p className="landing-subhead">
          A provenance cube: NFTs as materials, citations as structure.
        </p>
        <p className="landing-body">
          <CubixlesLogo className="cubixles-logo-inline" /> mints ERC-721s that pair a
          palette thumbnail with a live cube viewer. You choose 1–6 NFTs you own; the cube
          displays them as faces while sealing their full provenance in metadata.
        </p>
        <div className="landing-ctas">
          <Link href="/" className="landing-button primary">
            Enter the Mini App
          </Link>
          <Link href="/m/1" className="landing-button secondary">
            View Example Token
          </Link>
          <Link
            href="https://github.com/danyel-ii/cubixles_-miniapp/blob/main/MASTER.md"
            className="landing-button tertiary"
            target="_blank"
            rel="noreferrer"
          >
            Read the Spec
          </Link>
        </div>
      </div>
    </section>
  );
}
