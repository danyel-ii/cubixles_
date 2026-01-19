"use client";

import { useCallback, useRef } from "react";
import LandingSketch from "./LandingSketch";

export default function LandingCubeIcon() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleRotationChange = useCallback(
    (rotationX: number, rotationY: number) => {
      const node = containerRef.current;
      if (!node) {
        return;
      }
      const composite = (rotationX + rotationY) / 2;
      node.style.setProperty("--cube-rotation", `${composite}rad`);
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className="landing-cube-icon"
      data-cube-icon
      aria-hidden="true"
    >
      <LandingSketch
        onFaceChange={() => {}}
        onRotationChange={handleRotationChange}
      />
    </div>
  );
}
