"use client";

import { useEffect, useRef, useState } from "react";

import type { FaceDefinition } from "../_data/landing-provenance";

type LandingSketchProps = {
  onFaceChange: (faceId: FaceDefinition["id"]) => void;
  onRotationChange?: (rotationX: number, rotationY: number) => void;
};

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
        const P5Module = await import("p5");
        const { createLandingSketch } = await import("../_sketches/landing-sketch");
        if (cancelled) {
          return;
        }
        sketchInstance = new P5Module.default(
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
