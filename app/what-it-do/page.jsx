"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import "../world/world.css";
import "./what-it-do.css";

const LiteWorld = dynamic(() => import("../world/WorldScene.jsx"), {
  ssr: false,
});

const CUBIXLES_SCAPE_URL =
  process.env.NEXT_PUBLIC_CUBIXLES_SCAPE_DEV_URL ||
  "/what-it-do/cubixles_scape/index.html";

const MODES = [
  { key: "grand", label: "cubixles_scape" },
  { key: "lite", label: "Lightweight World" },
];

export default function WhereToPage() {
  const [mode, setMode] = useState("grand");

  return (
    <div className="where-to-page">
      <header className="where-to-header">
        <div className="where-to-title">What It Do</div>
        <div className="where-to-subtitle">
          Choose between the full cubixles_scape and the lightweight scene.
        </div>
        <div className="where-to-actions">
          {MODES.map((item) => (
            <button
              key={item.key}
              className={`where-to-toggle ${mode === item.key ? "is-active" : ""}`}
              onClick={() => setMode(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="where-to-links">
          <a href="/what-it-do/cubixles_scape" rel="noreferrer">
            Open cubixles_scape only
          </a>
          <a href="/what-it-do/lite" rel="noreferrer">
            Open Lightweight only
          </a>
        </div>
      </header>
      <section className="where-to-stage">
        <div className="where-to-frame">
          {mode === "grand" ? (
            <iframe
              title="cubixles_scape"
              src={CUBIXLES_SCAPE_URL}
              loading="lazy"
            />
          ) : (
            <div className="where-to-lite">
              <LiteWorld />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
