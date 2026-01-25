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
