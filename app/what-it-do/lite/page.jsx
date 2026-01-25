"use client";

import dynamic from "next/dynamic";
import "../../world/world.css";
import "../what-it-do.css";

const LiteWorld = dynamic(() => import("../../world/WorldScene.jsx"), {
  ssr: false,
});

export default function LiteWorldPage() {
  return (
    <div className="where-to-page">
      <section className="where-to-stage">
        <div className="where-to-frame">
          <div className="where-to-lite">
            <LiteWorld />
          </div>
        </div>
      </section>
    </div>
  );
}
