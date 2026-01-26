 "use client";

import { useEffect, useRef, useState } from "react";
import "./what-it-do.css";

const CUBIXLES_SCAPE_URL =
  process.env.NEXT_PUBLIC_CUBIXLES_SCAPE_DEV_URL ||
  "/what-it-do/cubixles_scape/index.html";

export default function WhatItDoPage() {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "navigate" || typeof data.url !== "string")
        return;

      try {
        const target = new URL(data.url, window.location.origin);
        const allowedOrigins = new Set([
          window.location.origin,
          "https://cubixles.xyz",
          "https://www.cubixles.xyz",
        ]);
        const allowedPaths = new Set([
          "/",
          "/shaolin_deck",
          "/inspecta_deck",
        ]);

        if (!allowedOrigins.has(target.origin)) return;
        if (!allowedPaths.has(target.pathname)) return;

        window.location.assign(target.toString());
      } catch {
        // ignore invalid urls
      }
    };

    window.addEventListener("message", handleMessage);
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      try {
        iframe.contentWindow?.focus();
      } catch {
        // ignore
      }
      setLoading(false);
    };
    iframe.addEventListener("load", handleLoad);
    return () => {
      window.removeEventListener("message", handleMessage);
      iframe.removeEventListener("load", handleLoad);
    };
  }, []);

  return (
    <div className="where-to-page">
      <section className="where-to-stage">
        <div
          className="where-to-frame"
          onClick={() => iframeRef.current?.contentWindow?.focus()}
        >
          <div className={`where-to-loading ${loading ? "" : "is-hidden"}`}>
            <div className="spinner" />
            <div>Loading cubixles_scape</div>
          </div>
          <iframe
            title="cubixles_scape"
            src={CUBIXLES_SCAPE_URL}
            loading="eager"
            tabIndex={0}
            ref={iframeRef}
            allow="autoplay; fullscreen; gamepad; xr-spatial-tracking; pointer-lock"
          />
        </div>
      </section>
    </div>
  );
}
