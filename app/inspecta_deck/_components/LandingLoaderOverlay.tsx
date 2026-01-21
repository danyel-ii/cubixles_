"use client";

import { useEffect, useState } from "react";

import { withBasePath } from "../_lib/basePath";

const LOADER_VISIBLE_MS = 1600;
const LOADER_FADE_MS = 2000;

export default function LandingLoaderOverlay() {
  const [phase, setPhase] = useState<"visible" | "fade" | "hidden">("visible");

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setPhase("fade"), LOADER_VISIBLE_MS);
    const hideTimer = window.setTimeout(
      () => setPhase("hidden"),
      LOADER_VISIBLE_MS + LOADER_FADE_MS
    );
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") {
    return null;
  }

  const loaderUrl = withBasePath("/assets/loader.png");
  const loaderMobileUrl = withBasePath("/assets/loader_mobile.jpg");

  return (
    <div
      className={`landing-loader${phase === "fade" ? " is-fading" : ""}`}
      aria-hidden="true"
    >
      <div
        className="landing-loader-art"
        style={
          {
            "--loader-image": `url(${loaderUrl})`,
            "--loader-image-mobile": `url(${loaderMobileUrl})`,
          } as React.CSSProperties
        }
      ></div>
    </div>
  );
}
