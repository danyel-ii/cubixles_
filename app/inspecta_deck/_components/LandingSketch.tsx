"use client";

import { useEffect, useRef, useState } from "react";

import type { FaceDefinition } from "../_data/landing-provenance";

type LandingSketchProps = {
  onFaceChange: (faceId: FaceDefinition["id"]) => void;
  onRotationChange?: (rotationX: number, rotationY: number) => void;
};

function loadP5Library(): Promise<any> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("p5 unavailable on the server"));
  }
  if (typeof window.__CUBIXLES_P5__ === "function") {
    return Promise.resolve(window.__CUBIXLES_P5__);
  }
  const sharedPromise = (window as Window & { __CUBIXLES_P5_PROMISE__?: Promise<void> })
    .__CUBIXLES_P5_PROMISE__;
  if (sharedPromise) {
    return sharedPromise.then(() => window.__CUBIXLES_P5__);
  }
  const promise = import("p5").then((module) => {
    const P5 = module?.default ?? module;
    if (typeof P5 === "function") {
      (window as Window & { __CUBIXLES_P5__?: any }).__CUBIXLES_P5__ = P5;
      window.p5 = P5;
      return P5;
    }
    throw new Error("p5 loaded but did not register");
  });
  (window as Window & { __CUBIXLES_P5_PROMISE__?: Promise<void> }).__CUBIXLES_P5_PROMISE__ =
    promise;
  return promise;
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
