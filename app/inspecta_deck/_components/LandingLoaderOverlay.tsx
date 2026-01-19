"use client";

import { useEffect, useState } from "react";

import { withBasePath } from "../_lib/basePath";

const LOADER_DURATION_MS = 2000;

export default function LandingLoaderOverlay() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setActive(false), LOADER_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!active) {
    return null;
  }

  const loaderUrl = withBasePath("/assets/loader.png");

  return (
    <div className="landing-loader" aria-hidden="true">
      <div
        className="landing-loader-art"
        style={{ "--loader-mask": `url(${loaderUrl})` } as React.CSSProperties}
      ></div>
    </div>
  );
}
