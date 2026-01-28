 "use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
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
  const slides = useMemo(
    () => [
      {
        id: "intro",
        title: "cubixles_",
      },
      {
        id: "builder",
        title: "Builder mint",
      },
      {
        id: "inspecta",
        title: "Inspecta deck",
      },
      {
        id: "scape",
        title: "Cubixles_scape",
      },
    ],
    []
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const maxIndex = slides.length - 1;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerState = useRef({
    startX: 0,
    startY: 0,
    pointerId: null as number | null,
    isDragging: false,
  });

  const clampIndex = useCallback(
    (next: number) => Math.max(0, Math.min(maxIndex, next)),
    [maxIndex]
  );

  const goTo = useCallback(
    (next: number) => {
      setActiveIndex((current) => {
        const resolved = clampIndex(next);
        return resolved === current ? current : resolved;
      });
    },
    [clampIndex]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-swipe-ignore="true"]')) {
        return;
      }
      pointerState.current = {
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        isDragging: true,
      };
      trackRef.current?.setPointerCapture?.(event.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!pointerState.current.isDragging) {
        return;
      }
      const deltaX = Math.abs(event.clientX - pointerState.current.startX);
      const deltaY = Math.abs(event.clientY - pointerState.current.startY);
      if (deltaY > deltaX && deltaY > 24) {
        pointerState.current.isDragging = false;
        if (pointerState.current.pointerId !== null) {
          trackRef.current?.releasePointerCapture?.(pointerState.current.pointerId);
        }
      }
    },
    []
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!pointerState.current.isDragging) {
        return;
      }
      const deltaX = event.clientX - pointerState.current.startX;
      const deltaY = event.clientY - pointerState.current.startY;
      pointerState.current.isDragging = false;
      if (pointerState.current.pointerId !== null) {
        trackRef.current?.releasePointerCapture?.(pointerState.current.pointerId);
      }
      if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }
      if (deltaX < 0) {
        goTo(activeIndex + 1);
      } else {
        goTo(activeIndex - 1);
      }
    },
    [activeIndex, goTo]
  );

  return (
    <main className="landing-page landing-home landing-tour">
      <PaletteRandomizer />
      <LandingLoaderOverlay />
      <div
        className="landing-tour-shell"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={trackRef}
          className="landing-tour-track"
          style={{
            transform: `translateX(-${activeIndex * 100}%)`,
            width: `${slides.length * 100}%`,
          }}
        >
          <section className="landing-tour-slide" aria-hidden={activeIndex !== 0}>
            <div className="landing-header landing-tour-hero">
              <div className="landing-intro">
                <p className="panel-eyebrow">01 · Welcome</p>
                <h1 className="landing-title">
                  <a href="/" className="cubixles-logo-link">
                    <CubixlesLogo />
                  </a>
                </h1>
                <p className="landing-subhead">
                  Provenance as building blocks, NFTs as materials, and citations as
                  structure.
                </p>
                <p className="landing-body">
                  Swipe or tap through four moments to get oriented inside the
                  cubixles_ universe.
                </p>
                <div className="landing-ctas">
                  <button
                    type="button"
                    className="landing-button primary"
                    onClick={() => goTo(1)}
                  >
                    Start the tour
                  </button>
                  <a
                    href="https://www.cubixles.xyz/?skipIntro=1&skipOverlay=1"
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
            </div>
          </section>

          <section className="landing-tour-slide" aria-hidden={activeIndex !== 1}>
            <div className="landing-tour-panel">
              <p className="panel-eyebrow">02 · Builder mint</p>
              <h2 className="panel-title">Compose your cubixles_ on the builder track</h2>
              <p className="landing-subhead">
                Start with NFTs you already own. We turn those references into a
                minted cube with on-chain provenance baked in.
              </p>
              <p className="landing-body">
                The builder flow lives at <strong>/shaolin_deck</strong> and is
                where signatures, quote validation, and the mint transaction happen.
              </p>
              <div className="landing-ctas">
                <Link href="/shaolin_deck" className="landing-button primary">
                  Open builder
                </Link>
                <button
                  type="button"
                  className="landing-button secondary"
                  onClick={() => goTo(2)}
                >
                  Next: Inspecta deck
                </button>
              </div>
            </div>
          </section>

          <section className="landing-tour-slide" aria-hidden={activeIndex !== 2}>
            <div className="landing-tour-panel landing-tour-panel--wide">
              <div className="landing-tour-split">
                <div>
                  <p className="panel-eyebrow">03 · Inspecta deck</p>
                  <h2 className="panel-title">Trace every reference</h2>
                  <p className="landing-subhead">
                    Browse minted cubes, inspect provenance, and read the NFT
                    citations that shape each face.
                  </p>
                  <p className="landing-body">
                    Scroll the token panel, then swipe to move on.
                  </p>
                  <div className="landing-ctas">
                    <button
                      type="button"
                      className="landing-button secondary"
                      onClick={() => goTo(3)}
                    >
                      Next: cubixles_scape
                    </button>
                  </div>
                </div>
                <div className="landing-tour-scroll" data-swipe-ignore="true">
                  <section id="token-list" className="landing-token-list">
                    <TokenIndexPanel defaultChainId={LANDING_CHAIN_ID} />
                  </section>
                </div>
              </div>
            </div>
          </section>

          <section className="landing-tour-slide" aria-hidden={activeIndex !== 3}>
            <div className="landing-tour-panel">
              <p className="panel-eyebrow">04 · Cubixles_scape</p>
              <h2 className="panel-title">Drive the landscape</h2>
              <p className="landing-subhead">
                A playable world for exploring the lore, controls, and easter eggs.
              </p>
              <p className="landing-body">
                The scape is meant to be felt. Drop in, find stations, and explore
                the interactive markers across the map.
              </p>
              <div className="landing-ctas">
                <Link href="/what-it-do" className="landing-button primary">
                  Enter cubixles_scape
                </Link>
                <button
                  type="button"
                  className="landing-button secondary"
                  onClick={() => goTo(0)}
                >
                  Back to start
                </button>
              </div>
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
            </div>
          </section>
        </div>
      </div>

      <div className="landing-tour-nav" aria-label="Tour navigation">
        <button
          type="button"
          className="landing-nav-button"
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Previous"
        >
          ←
        </button>
        <div className="landing-nav-dots" role="tablist">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={`landing-nav-dot${index === activeIndex ? " is-active" : ""}`}
              onClick={() => goTo(index)}
              aria-label={`Go to ${slide.title}`}
              aria-selected={index === activeIndex}
              role="tab"
            />
          ))}
        </div>
        <button
          type="button"
          className="landing-nav-button"
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex === maxIndex}
          aria-label="Next"
        >
          →
        </button>
      </div>
    </main>
  );
}
