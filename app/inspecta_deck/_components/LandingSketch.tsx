"use client";

import { useEffect, useRef, useState } from "react";

import type { FaceDefinition } from "../_data/landing-provenance";

type LandingSketchProps = {
  onFaceChange: (faceId: FaceDefinition["id"]) => void;
  onRotationChange?: (rotationX: number, rotationY: number) => void;
};

const P5_SRC = "https://cdn.jsdelivr.net/npm/p5@1.9.2/lib/p5.min.js";

function loadP5Library(): Promise<any> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("p5 unavailable on the server"));
  }
  if (typeof window.p5 === "function") {
    return Promise.resolve(window.p5);
  }
  const sharedPromise = (window as Window & { __CUBIXLES_P5_PROMISE__?: Promise<void> })
    .__CUBIXLES_P5_PROMISE__;
  if (sharedPromise) {
    return sharedPromise.then(() => window.p5);
  }
  const existingScript = document.getElementById("p5-lib");
  const existing = existingScript || document.querySelector('script[src*="p5"]');
  if (existing) {
    return new Promise((resolve) => {
      const poll = () => {
        if (typeof window.p5 === "function") {
          resolve(window.p5);
          return;
        }
        window.setTimeout(poll, 50);
      };
      poll();
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "p5-lib";
    script.src = P5_SRC;
    script.async = true;
    script.onload = () => {
      if (typeof window.p5 === "function") {
        resolve(window.p5);
      } else {
        reject(new Error("p5 loaded but did not register"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load p5.js"));
    document.head.appendChild(script);
  });
}

export default function LandingSketch({
  onFaceChange,
  onRotationChange,
}: LandingSketchProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let sketchInstance: any;
    let cancelled = false;

    (async () => {
      try {
        const P5Module = (await loadP5Library()) as any;
        const { createLandingSketch } = await import("../_sketches/landing-sketch");
        if (cancelled) {
          return;
        }
        sketchInstance = new P5Module(
          (p5: any) =>
            createLandingSketch(p5, {
              onFaceChange,
              onRotationChange,
              parent: containerRef.current ?? undefined,
            }),
          containerRef.current ?? undefined
        );
      } catch (error) {
        console.error("p5 failed to load", error);
        if (!cancelled) {
          setHasError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      sketchInstance?.remove();
    };
  }, [onFaceChange, onRotationChange]);

  return (
    <div className="landing-sketch-shell">
      <div ref={containerRef} className="landing-sketch-canvas" />
      {hasError && (
        <div className="landing-sketch-fallback">
          <p>A cube waits here if your browser supported WebGL.</p>
        </div>
      )}
    </div>
  );
}
