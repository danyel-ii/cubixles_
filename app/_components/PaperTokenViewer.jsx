"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CubixlesLogo from "./CubixlesLogo.jsx";
import CubixlesText from "./CubixlesText.jsx";

const FACE_LAYOUTS = [
  { id: "+Z", className: "front" },
  { id: "-Z", className: "back" },
  { id: "+X", className: "right" },
  { id: "-X", className: "left" },
  { id: "+Y", className: "top" },
  { id: "-Y", className: "bottom" },
];
const FACE_NAMES = {
  "+Z": "Front",
  "-Z": "Back",
  "+X": "Right",
  "-X": "Left",
  "+Y": "Top",
  "-Y": "Bottom",
};
const FACE_ROTATIONS = {
  "+Z": { x: "-26deg", y: "38deg" },
  "-Z": { x: "-26deg", y: "218deg" },
  "+X": { x: "-26deg", y: "128deg" },
  "-X": { x: "-26deg", y: "-52deg" },
  "+Y": { x: "-112deg", y: "38deg" },
  "-Y": { x: "64deg", y: "38deg" },
};
const DEFAULT_ROTATION = FACE_ROTATIONS["+Z"];

function truncateMiddle(value, start = 6, end = 4) {
  if (value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatFloorValue(floorEth) {
  if (typeof floorEth !== "number" || Number.isNaN(floorEth)) {
    return "n/a";
  }
  return floorEth.toFixed(4);
}

function formatTimestamp(value) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

function formatAddress(value) {
  if (!value) {
    return "n/a";
  }
  if (value.startsWith("0x") && value.length > 12) {
    return truncateMiddle(value);
  }
  return value;
}

function pickFaceImage(face) {
  if (!face) {
    return null;
  }
  if (face.media?.imageCandidates?.length) {
    return face.media.imageCandidates[0] ?? null;
  }
  return face.media?.image ?? null;
}

export default function PaperTokenViewer({
  cube,
  requestedTokenId,
  palette = null,
}) {
  const viewerRef = useRef(null);
  const frameRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const cubeLinkRef = useRef(null);
  const cubeRef = useRef(null);
  const shadowRef = useRef(null);
  const faceRefs = useRef([]);
  const inspectorLineRef = useRef(null);
  const inspectorPanelRef = useRef(null);
  const inspectedIndexRef = useRef(null);
  const [inspectedIndex, setInspectedIndex] = useState(null);
  const [baseRotation, setBaseRotation] = useState(DEFAULT_ROTATION);

  const faces = useMemo(() => {
    const byId = new Map();
    (cube?.provenanceNFTs || []).forEach((face) => {
      byId.set(face.faceId, face);
    });

    return FACE_LAYOUTS.map((layout) => {
      const face = byId.get(layout.id);
      const label = face?.collection || face?.title || `Face ${layout.id}`;
      return {
        id: layout.id,
        className: layout.className,
        label,
        image: pickFaceImage(face),
        title: face?.title || label,
        collection: face?.collection || label,
        tokenId: face?.tokenId ? String(face.tokenId) : "",
        contractAddress: face?.contractAddress || "",
        floorEth: face?.floorEth ?? null,
        floorRetrievedAt: face?.floorRetrievedAt ?? null,
        explorerUrl: face?.explorerUrl || "",
      };
    });
  }, [cube?.provenanceNFTs]);

  useEffect(() => {
    setBaseRotation(DEFAULT_ROTATION);
    setInspectedIndex(null);
  }, [cube?.tokenId]);

  useEffect(() => {
    inspectedIndexRef.current = inspectedIndex;
  }, [inspectedIndex]);

  const updateInspectorLayout = useCallback(() => {
    const index = inspectedIndexRef.current;
    if (index === null || index === undefined) {
      return;
    }
    const viewer = viewerRef.current;
    const faceEl = faceRefs.current[index];
    const line = inspectorLineRef.current;
    const panel = inspectorPanelRef.current;
    if (!viewer || !faceEl || !line || !panel) {
      return;
    }
    const viewerRect = viewer.getBoundingClientRect();
    const faceRect = faceEl.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const faceCenterX = faceRect.left + faceRect.width / 2;
    const faceCenterY = faceRect.top + faceRect.height / 2;
    const viewerCenterX = viewerRect.left + viewerRect.width / 2;
    const preferRight = faceCenterX < viewerCenterX;
    const offset = 90;
    const margin = 24;
    let panelX = preferRight
      ? faceCenterX + offset
      : faceCenterX - panelRect.width - offset;
    let panelY = faceCenterY - panelRect.height / 2;
    panelX = clamp(
      panelX,
      viewerRect.left + margin,
      viewerRect.right - panelRect.width - margin
    );
    panelY = clamp(
      panelY,
      viewerRect.top + margin,
      viewerRect.bottom - panelRect.height - margin
    );
    const translateX = panelX - viewerRect.left;
    const translateY = panelY - viewerRect.top;
    panel.style.transform = `translate(${translateX}px, ${translateY}px)`;
    panel.style.opacity = "1";

    const anchorX = panelX + (preferRight ? 0 : panelRect.width);
    const anchorY = panelY + panelRect.height / 2;
    const startX = faceCenterX - viewerRect.left;
    const startY = faceCenterY - viewerRect.top;
    const dx = anchorX - faceCenterX;
    const dy = anchorY - faceCenterY;
    const length = Math.max(24, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    line.style.width = `${length}px`;
    line.style.transform = `translate(${startX}px, ${startY}px) rotate(${angle}rad)`;
    line.style.opacity = "1";
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current !== null || typeof window === "undefined") {
      return;
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const viewer = viewerRef.current;
      if (!viewer) {
        return;
      }
      const { x, y } = pointerRef.current;
      const tiltX = (-y * 20).toFixed(2);
      const tiltY = (x * 28).toFixed(2);
      const shadowX = (x * 40).toFixed(2);
      const shadowY = (y * -32).toFixed(2);
      const shiftX = (x * 120).toFixed(2);
      const shiftY = (y * 90).toFixed(2);

      const link = cubeLinkRef.current;
      const cubeEl = cubeRef.current;
      const shadow = shadowRef.current;
      const tiltXValue = `${tiltX}deg`;
      const tiltYValue = `${tiltY}deg`;
      const shadowXValue = `${shadowX}px`;
      const shadowYValue = `${shadowY}px`;
      const shiftXValue = `${shiftX}px`;
      const shiftYValue = `${shiftY}px`;

      const applyVars = (node) => {
        if (!node) {
          return;
        }
        node.style.setProperty("--cube-tilt-x", tiltXValue);
        node.style.setProperty("--cube-tilt-y", tiltYValue);
        node.style.setProperty("--cube-shadow-x", shadowXValue);
        node.style.setProperty("--cube-shadow-y", shadowYValue);
        node.style.setProperty("--cube-shift-x", shiftXValue);
        node.style.setProperty("--cube-shift-y", shiftYValue);
      };

      applyVars(viewer);
      applyVars(link);
      applyVars(cubeEl);

      if (link) {
        link.style.transform = `translate3d(${shiftXValue}, ${shiftYValue}, 0)`;
      }
      if (shadow) {
        shadow.style.transform = `translate(calc(-50% + ${shadowXValue}), ${shadowYValue})`;
      }
      if (inspectedIndexRef.current !== null) {
        updateInspectorLayout();
      }
    });
  }, [updateInspectorLayout]);

  const updatePointer = useCallback(
    (clientX, clientY) => {
      const viewer = viewerRef.current;
      if (!viewer) {
        return;
      }
      const rect = viewer.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((clientY - rect.top) / rect.height - 0.5) * 2;

      pointerRef.current = {
        x: clamp(x, -1, 1),
        y: clamp(y, -1, 1),
      };
      scheduleUpdate();
    },
    [scheduleUpdate]
  );

  const handlePointerMove = (event) => {
    updatePointer(event.clientX, event.clientY);
  };

  const handlePointerLeave = () => {
    pointerRef.current = { x: 0, y: 0 };
    scheduleUpdate();
  };

  useEffect(() => {
    scheduleUpdate();
    const handleWindowMove = (event) => {
      updatePointer(event.clientX, event.clientY);
    };
    const resetVars = (node) => {
      if (!node) {
        return;
      }
      node.style.setProperty("--cube-tilt-x", "0deg");
      node.style.setProperty("--cube-tilt-y", "0deg");
      node.style.setProperty("--cube-shadow-x", "0px");
      node.style.setProperty("--cube-shadow-y", "0px");
      node.style.setProperty("--cube-shift-x", "0px");
      node.style.setProperty("--cube-shift-y", "0px");
    };
    const handleWindowLeave = () => {
      pointerRef.current = { x: 0, y: 0 };
      scheduleUpdate();
      resetVars(viewerRef.current);
      resetVars(cubeLinkRef.current);
      resetVars(cubeRef.current);
      if (cubeLinkRef.current) {
        cubeLinkRef.current.style.transform = "translate3d(0, 0, 0)";
      }
      if (shadowRef.current) {
        shadowRef.current.style.transform = "translate(-50%, 0)";
      }
    };
    window.addEventListener("pointermove", handleWindowMove, { passive: true });
    window.addEventListener("mousemove", handleWindowMove, { passive: true });
    window.addEventListener("pointerleave", handleWindowLeave);
    window.addEventListener("blur", handleWindowLeave);
    return () => {
      window.removeEventListener("pointermove", handleWindowMove);
      window.removeEventListener("mousemove", handleWindowMove);
      window.removeEventListener("pointerleave", handleWindowLeave);
      window.removeEventListener("blur", handleWindowLeave);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [scheduleUpdate, updatePointer]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (inspectedIndex === null) {
      return;
    }
    const frame = window.requestAnimationFrame(updateInspectorLayout);
    return () => window.cancelAnimationFrame(frame);
  }, [inspectedIndex, updateInspectorLayout]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => updateInspectorLayout();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateInspectorLayout]);

  const handleFaceInspect = useCallback(
    (index) => {
      const face = faces[index];
      if (!face) {
        return;
      }
      setBaseRotation(FACE_ROTATIONS[face.id] ?? DEFAULT_ROTATION);
      setInspectedIndex((current) => (current === index ? null : index));
    },
    [faces]
  );

  const truncatedTokenId = truncateMiddle(String(cube?.tokenId || ""));
  const displayDescription = useMemo(() => {
    if (!cube?.description) {
      return "";
    }
    const truncated = truncatedTokenId;
    let next = cube.description.replaceAll(String(cube.tokenId), truncated);
    if (requestedTokenId !== cube.tokenId) {
      next = next.replaceAll(String(requestedTokenId), truncated);
    }
    return next.replace(/\b\d{20,}\b/g, (match) => truncateMiddle(match));
  }, [cube?.description, cube?.tokenId, requestedTokenId, truncatedTokenId]);
  const isMismatch = cube?.tokenId !== requestedTokenId;

  const handleExportHtml = useCallback(() => {
    if (!cube) {
      return;
    }
    const escapeHtml = (value) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const exportFaces = faces
      .map((face) => {
        const image = face.image ? encodeURI(face.image) : "";
        const style = image
          ? ` style=\"--face-image: url('${escapeHtml(image)}')\"`
          : " style=\"--face-image: none\"";
        const label = escapeHtml(face.label);
        return `
        <div class=\"paper-cube-face paper-face-${face.className}\"${style}>
          ${image ? "" : `<span class=\"paper-face-label\">${label}</span>`}
        </div>`;
      })
      .join("");

    const exportStyles = `
      @import url(\"https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Space+Grotesk:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap\");
      :root {
        --paper-base: #f7f2e8;
        --paper-ink: #1b1713;
        --paper-grid: rgba(30, 45, 70, 0.16);
        --paper-grid-bold: rgba(30, 45, 70, 0.3);
        --paper-grid-size: 24px;
        --paper-grid-bold-size: 120px;
        --paper-margin: rgba(208, 88, 88, 0.7);
        --paper-panel: rgba(255, 255, 255, 0.92);
        --paper-shadow: rgba(18, 14, 10, 0.25);
        --cube-size: min(360px, 60vw);
        --cube-base-x: -26deg;
        --cube-base-y: 38deg;
        --cube-tilt-x: 0deg;
        --cube-tilt-y: 0deg;
        --cube-shadow-x: 0px;
        --cube-shadow-y: 0px;
      }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: \"Space Grotesk\", \"Instrument Sans\", sans-serif; }
      .paper-viewer {
        min-height: 100vh;
        position: relative;
        overflow: hidden;
        display: grid;
        place-items: center;
        padding: 48px;
        background: var(--paper-base);
        color: var(--paper-ink);
        perspective: 1400px;
        transform-style: preserve-3d;
      }
      .paper-viewer::before {
        content: \"\";
        position: absolute;
        inset: 0;
        background-image:
          repeating-linear-gradient(
            to right,
            transparent,
            transparent calc(var(--paper-grid-size) - 1px),
            var(--paper-grid) calc(var(--paper-grid-size))
          ),
          repeating-linear-gradient(
            to bottom,
            transparent,
            transparent calc(var(--paper-grid-size) - 1px),
            var(--paper-grid) calc(var(--paper-grid-size))
          ),
          repeating-linear-gradient(
            to right,
            transparent,
            transparent calc(var(--paper-grid-bold-size) - 1px),
            var(--paper-grid-bold) calc(var(--paper-grid-bold-size))
          ),
          repeating-linear-gradient(
            to bottom,
            transparent,
            transparent calc(var(--paper-grid-bold-size) - 1px),
            var(--paper-grid-bold) calc(var(--paper-grid-bold-size))
          ),
          linear-gradient(
            to right,
            transparent 0,
            transparent 62px,
            var(--paper-margin) 62px,
            var(--paper-margin) 64px,
            transparent 64px
          );
        opacity: 0.9;
        pointer-events: none;
        z-index: 0;
      }
      .paper-header {
        position: absolute;
        top: 32px;
        left: 40px;
        max-width: 520px;
        padding: 18px 20px;
        border-radius: 12px;
        border: 2px solid var(--paper-ink);
        background: var(--paper-panel);
        box-shadow: 8px 8px 0 var(--paper-ink);
        z-index: 3;
      }
      .paper-eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.2em; }
      .paper-title { margin: 0 0 10px; font-size: 2rem; }
      .paper-subhead { margin: 0; font-size: 0.95rem; }
      .paper-stage { position: absolute; inset: 0; display: grid; place-items: center; z-index: 2; }
      .paper-cube {
        position: relative;
        width: var(--cube-size);
        height: var(--cube-size);
        transform-style: preserve-3d;
        transform: rotateX(var(--cube-base-x)) rotateY(var(--cube-base-y));
      }
      .paper-cube-face {
        position: absolute;
        inset: 0;
        background-color: #d8d2c8;
        background-image: var(--face-image);
        background-size: cover;
        background-position: center;
        border: 1px solid rgba(0, 0, 0, 0.3);
      }
      .paper-face-front { transform: translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-back { transform: rotateY(180deg) translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-right { transform: rotateY(90deg) translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-left { transform: rotateY(-90deg) translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-top { transform: rotateX(90deg) translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-bottom { transform: rotateX(-90deg) translateZ(calc(var(--cube-size) / 2)); }
    `;

    const html = `<!doctype html>
      <html lang=\"en\">
      <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>cubixles_ Token ${escapeHtml(truncatedTokenId)} viewer 02</title>
        <style>${exportStyles}</style>
      </head>
      <body>
        <main class=\"paper-viewer\">
          <header class=\"paper-header\">
            <p class=\"paper-eyebrow\">Token viewer 02</p>
            <h1 class=\"paper-title\">cubixles_ Token ${escapeHtml(truncatedTokenId)}</h1>
            <p class=\"paper-subhead\">${escapeHtml(displayDescription)}</p>
          </header>
          <div class=\"paper-stage\">
            <div class=\"paper-cube\">${exportFaces}</div>
          </div>
        </main>
      </body>
      </html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cubixles_${truncatedTokenId}_viewer02.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [cube, displayDescription, faces, truncatedTokenId]);

  if (!cube) {
    return null;
  }

  const inspectedFace =
    inspectedIndex !== null && inspectedIndex !== undefined
      ? faces[inspectedIndex]
      : null;
  const paletteSwatches = Array.isArray(palette) ? palette : [];
  const floorLabel = inspectedFace
    ? formatFloorValue(inspectedFace.floorEth)
    : "n/a";
  const floorText = floorLabel === "n/a" ? "n/a" : `${floorLabel} ETH`;

  return (
    <main
      ref={viewerRef}
      className="paper-viewer"
      style={{
        "--cube-base-x": baseRotation.x,
        "--cube-base-y": baseRotation.y,
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <header className="paper-header">
        <p className="paper-eyebrow">Token viewer 02</p>
        <h1 className="paper-title" title={cube.tokenId}>
          <CubixlesLogo className="cubixles-logo-inline" />
          Token {truncatedTokenId}
        </h1>
        <p className="paper-subhead">
          <CubixlesText text={displayDescription} />
        </p>
        {isMismatch && (
          <p className="paper-note" title={cube.tokenId}>
            Showing minted cube for {truncatedTokenId}.
          </p>
        )}
        <div className="paper-actions">
          <button
            type="button"
            className="paper-export-button"
            onClick={handleExportHtml}
          >
            Export to HTML
          </button>
          <a
            className="paper-export-button paper-link-button"
            href="https://opensea.io/collection/cubixles"
            target="_blank"
            rel="noreferrer"
          >
            OpenSea
          </a>
        </div>
      </header>

      <div className="paper-stage" aria-hidden="false">
        <div
          ref={cubeLinkRef}
          className="paper-cube-link"
          aria-label="Cubixles cube"
        >
          <div ref={shadowRef} className="paper-cube-shadow" aria-hidden="true" />
          <div
            ref={cubeRef}
            className="paper-cube"
            role="img"
            aria-label={`Cubixles token ${truncatedTokenId}`}
          >
            {faces.map((face, index) => {
              const style = {
                "--face-image": face.image ? `url(\"${face.image}\")` : "none",
              };
              const isActive = inspectedIndex === index;
              return (
                <div
                  key={face.id}
                  ref={(node) => {
                    faceRefs.current[index] = node;
                  }}
                  className={`paper-cube-face paper-face-${face.className}${
                    isActive ? " is-active" : ""
                  }`}
                  style={style}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  aria-label={`${FACE_NAMES[face.id] || "Face"}: ${face.label}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleFaceInspect(index);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleFaceInspect(index);
                    }
                  }}
                >
                  {!face.image && (
                    <span className="paper-face-label">{face.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {inspectedFace && (
        <>
          <div
            ref={inspectorLineRef}
            className="paper-inspector-line"
            aria-hidden="true"
          />
          <aside
            ref={inspectorPanelRef}
            className="paper-inspector"
            role="dialog"
            aria-label={`Inspect ${inspectedFace.label}`}
          >
            <div className="paper-inspector-header">
              <div>
                <span className="paper-inspector-eyebrow">
                  {FACE_NAMES[inspectedFace.id] || "Face"}
                </span>
                <h2 className="paper-inspector-title">{inspectedFace.title}</h2>
              </div>
              <button
                type="button"
                className="paper-inspector-close"
                onClick={() => setInspectedIndex(null)}
                aria-label="Close inspector"
              >
                Close
              </button>
            </div>
            <div className="paper-inspector-body">
              {inspectedFace.image ? (
                <img
                  className="paper-inspector-thumb"
                  src={inspectedFace.image}
                  alt={inspectedFace.title}
                  loading="lazy"
                />
              ) : (
                <div className="paper-inspector-thumb is-empty">No image</div>
              )}
              <div className="paper-inspector-meta">
                <div>
                  <span className="paper-meta-label">Token</span>
                  <span>{truncateMiddle(inspectedFace.tokenId || "n/a")}</span>
                </div>
                <div>
                  <span className="paper-meta-label">Contract</span>
                  <span>{formatAddress(inspectedFace.contractAddress)}</span>
                </div>
                <div>
                  <span className="paper-meta-label">Floor</span>
                  <span>{floorText}</span>
                </div>
                <div>
                  <span className="paper-meta-label">Updated</span>
                  <span>{formatTimestamp(inspectedFace.floorRetrievedAt)}</span>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {faces.length > 0 && (
        <div className="paper-face-map" role="group" aria-label="Cube faces">
          {faces.map((face, index) => {
            const isActive = inspectedIndex === index;
            return (
              <button
                key={`${face.id}-chip`}
                type="button"
                className={`paper-face-chip${isActive ? " is-active" : ""}`}
                onClick={() => handleFaceInspect(index)}
                aria-pressed={isActive}
                title={`${FACE_NAMES[face.id] || face.id} face`}
              >
                <span>{FACE_NAMES[face.id] || face.id}</span>
              </button>
            );
          })}
        </div>
      )}

      {paletteSwatches.length > 0 && (
        <aside className="paper-palette" aria-label="Active palette">
          <span className="paper-palette-label">Palette</span>
          <div className="paper-palette-swatches">
            {paletteSwatches.map((color, index) => (
              <span
                key={`${color}-${index}`}
                className="paper-palette-swatch"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </aside>
      )}

      <aside className="paper-meta">
        <div>
          <span className="paper-meta-label">Minted</span>
          <span>{cube.mintedAt}</span>
        </div>
        <div>
          <span className="paper-meta-label">Network</span>
          <span>{cube.network}</span>
        </div>
        <div>
          <span className="paper-meta-label">By</span>
          <span>{cube.mintedBy}</span>
        </div>
      </aside>
    </main>
  );
}
