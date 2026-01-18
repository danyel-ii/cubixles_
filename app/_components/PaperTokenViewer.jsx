"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

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

function hexToRgb(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  const int = Number.parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbaString({ r, g, b }, alpha) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getLuminance({ r, g, b }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function formatFloorValue(floorEth) {
  if (typeof floorEth !== "number" || Number.isNaN(floorEth)) {
    return "n/a";
  }
  return floorEth.toFixed(4);
}

function formatSignedValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value).toFixed(4);
  return `${sign}${abs}`;
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

async function sampleAverageColor(url) {
  if (!url || typeof url !== "string") {
    return null;
  }
  const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    return null;
  }
  const blob = await response.blob();
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (error) {
    return null;
  }
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    if (bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, size, size);
  if (bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }
  const { data } = ctx.getImageData(0, 0, size, size);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 10) {
      continue;
    }
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }
  if (!count) {
    return null;
  }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

export default function PaperTokenViewer({
  cube,
  requestedTokenId,
  palette = null,
  allowExport = true,
}) {
  const viewerRef = useRef(null);
  const frameRef = useRef(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startRotX: 0,
    startRotY: 0,
    moved: false,
    lastMoveDistance: 0,
    lastDragAt: 0,
  });
  const cubeLinkRef = useRef(null);
  const cubeRef = useRef(null);
  const shadowRef = useRef(null);
  const faceRefs = useRef([]);
  const inspectorLineRefs = useRef([]);
  const inspectorPanelRefs = useRef([]);
  const inspectorPositionsRef = useRef(new Map());
  const inspectorDragRef = useRef({
    active: false,
    index: null,
    startX: 0,
    startY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
    width: 0,
    height: 0,
    moved: false,
  });
  const inspectedIndicesRef = useRef([]);
  const [inspectedIndices, setInspectedIndices] = useState([]);
  const [baseRotation, setBaseRotation] = useState(DEFAULT_ROTATION);
  const [hudOpen, setHudOpen] = useState(true);
  const [diffusionAverage, setDiffusionAverage] = useState(null);
  const [diffusionStatus, setDiffusionStatus] = useState("idle");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

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

  const paletteSwatches = useMemo(
    () => (Array.isArray(palette) ? palette : []),
    [palette]
  );
  const edgeColor = useMemo(() => {
    if (!paletteSwatches.length) {
      return null;
    }
    let bestColor = null;
    let bestLuminance = Infinity;
    paletteSwatches.forEach((color) => {
      const rgb = hexToRgb(color);
      if (!rgb) {
        return;
      }
      const luminance = getLuminance(rgb);
      if (luminance < bestLuminance) {
        bestLuminance = luminance;
        bestColor = color;
      }
    });
    return bestColor || paletteSwatches[0];
  }, [paletteSwatches]);
  const edgeGlow = useMemo(() => {
    if (!edgeColor) {
      return null;
    }
    const rgb = hexToRgb(edgeColor);
    return rgb ? rgbaString(rgb, 0.45) : null;
  }, [edgeColor]);
  const qrAddress = useMemo(() => {
    const raw = cube?.mintedBy || "";
    return /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : "";
  }, [cube?.mintedBy]);

  useEffect(() => {
    if (!qrAddress || typeof window === "undefined") {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qrAddress, {
      width: 180,
      margin: 1,
      color: {
        dark: "#1b1713",
        light: "#f7f2e8",
      },
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [qrAddress]);

  useEffect(() => {
    setBaseRotation(DEFAULT_ROTATION);
    rotationRef.current = { x: 0, y: 0 };
    setInspectedIndices([]);
  }, [cube?.tokenId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const urls = faces.map((face) => face.image).filter(Boolean);
    if (!urls.length) {
      setDiffusionAverage(null);
      setDiffusionStatus("idle");
      return;
    }
    let cancelled = false;
    const load = async () => {
      setDiffusionStatus("loading");
      const samples = await Promise.all(
        urls.slice(0, 6).map(async (url) => {
          try {
            return await sampleAverageColor(url);
          } catch (error) {
            return null;
          }
        })
      );
      if (cancelled) {
        return;
      }
      const valid = samples.filter(Boolean);
      if (!valid.length) {
        setDiffusionAverage(null);
        setDiffusionStatus("error");
        return;
      }
      const sum = valid.reduce(
        (acc, color) => ({
          r: acc.r + color.r,
          g: acc.g + color.g,
          b: acc.b + color.b,
        }),
        { r: 0, g: 0, b: 0 }
      );
      const avg = {
        r: Math.round(sum.r / valid.length),
        g: Math.round(sum.g / valid.length),
        b: Math.round(sum.b / valid.length),
      };
      setDiffusionAverage({ ...avg, hex: rgbToHex(avg) });
      setDiffusionStatus("ready");
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [faces]);

  useLayoutEffect(() => {
    inspectedIndicesRef.current = inspectedIndices;
  }, [inspectedIndices]);

  useEffect(() => {
    const active = new Set(inspectedIndices);
    for (const key of inspectorPositionsRef.current.keys()) {
      if (!active.has(key)) {
        inspectorPositionsRef.current.delete(key);
      }
    }
  }, [inspectedIndices]);

  const updateInspectorLayout = useCallback(() => {
    const indices = inspectedIndicesRef.current;
    if (!indices.length) {
      return;
    }
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }
    const viewerRect = viewer.getBoundingClientRect();
    const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;
    const offset = isDesktop ? 170 : 110;
    const margin = isDesktop ? 32 : 20;

    indices.forEach((index) => {
      const faceEl = faceRefs.current[index];
      const line = inspectorLineRefs.current[index];
      const panel = inspectorPanelRefs.current[index];
      if (!faceEl || !line || !panel) {
        return;
      }
      const faceRect = faceEl.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const faceCenterX = faceRect.left + faceRect.width / 2;
      const faceCenterY = faceRect.top + faceRect.height / 2;
      const manualPosition = inspectorPositionsRef.current.get(index);
      let panelX = manualPosition
        ? viewerRect.left + manualPosition.x
        : faceCenterX + offset;
      let panelY = manualPosition
        ? viewerRect.top + manualPosition.y
        : faceCenterY - panelRect.height / 2;
      if (!manualPosition) {
        const viewerCenterX = viewerRect.left + viewerRect.width / 2;
        const preferRight = faceCenterX < viewerCenterX;
        panelX = preferRight
          ? faceCenterX + offset
          : faceCenterX - panelRect.width - offset;
      }
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

      if (manualPosition) {
        inspectorPositionsRef.current.set(index, { x: translateX, y: translateY });
      }

      const panelCenterX = panelX + panelRect.width / 2;
      const anchorLeftEdge = faceCenterX < panelCenterX;
      const anchorX = panelX + (anchorLeftEdge ? 0 : panelRect.width);
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
    });
  }, []);

  const startInspectorDrag = useCallback(
    (index, event) => {
      if (typeof event.button === "number" && event.button !== 0) {
        return;
      }
      if (event.target instanceof Element && event.target.closest("button")) {
        return;
      }
      if (inspectorDragRef.current.active) {
        return;
      }
      const viewer = viewerRef.current;
      const panel = inspectorPanelRefs.current[index];
      if (!viewer || !panel) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const viewerRect = viewer.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const startTranslateX = panelRect.left - viewerRect.left;
      const startTranslateY = panelRect.top - viewerRect.top;
      inspectorPositionsRef.current.set(index, { x: startTranslateX, y: startTranslateY });
      inspectorDragRef.current = {
        active: true,
        index,
        startX: event.clientX,
        startY: event.clientY,
        startTranslateX,
        startTranslateY,
        width: panelRect.width,
        height: panelRect.height,
        moved: false,
      };
      panel.classList.add("is-dragging");
      if (event.currentTarget?.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    []
  );

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
      const tiltX = 0;
      const tiltY = 0;
      const shadowX = 0;
      const shadowY = 0;
      const shiftX = 0;
      const shiftY = 0;
      const rotationX = rotationRef.current.x.toFixed(2);
      const rotationY = rotationRef.current.y.toFixed(2);

      const link = cubeLinkRef.current;
      const cubeEl = cubeRef.current;
      const shadow = shadowRef.current;
      const tiltXValue = `${tiltX}deg`;
      const tiltYValue = `${tiltY}deg`;
      const shadowXValue = `${shadowX}px`;
      const shadowYValue = `${shadowY}px`;
      const shiftXValue = `${shiftX}px`;
      const shiftYValue = `${shiftY}px`;
      const rotationXValue = `${rotationX}deg`;
      const rotationYValue = `${rotationY}deg`;

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
        node.style.setProperty("--cube-user-x", rotationXValue);
        node.style.setProperty("--cube-user-y", rotationYValue);
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
      if (inspectedIndicesRef.current.length > 0) {
        updateInspectorLayout();
      }
    });
  }, [updateInspectorLayout]);

  const startDrag = useCallback((event) => {
    if (event.button && event.button !== 0) {
      return;
    }
    dragRef.current.active = true;
    dragRef.current.startX = event.clientX;
    dragRef.current.startY = event.clientY;
    dragRef.current.startRotX = rotationRef.current.x;
    dragRef.current.startRotY = rotationRef.current.y;
    dragRef.current.moved = false;
    dragRef.current.lastMoveDistance = 0;
  }, []);

  const endDrag = useCallback(() => {
    if (dragRef.current.moved && dragRef.current.lastMoveDistance > 12) {
      dragRef.current.lastDragAt = Date.now();
    }
    dragRef.current.active = false;
    dragRef.current.moved = false;
  }, []);

  const updateRotationFromDrag = useCallback(
    (clientX, clientY) => {
      if (!dragRef.current.active) {
        return;
      }
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      const distance = Math.hypot(dx, dy);
      dragRef.current.lastMoveDistance = distance;
      if (!dragRef.current.moved && distance > 12) {
        dragRef.current.moved = true;
      }
      const nextX = clamp(dragRef.current.startRotX + dy * 0.35, -80, 80);
      const nextY = dragRef.current.startRotY + dx * 0.45;
      rotationRef.current = { x: nextX, y: nextY };
      scheduleUpdate();
    },
    [scheduleUpdate]
  );

  useEffect(() => {
    scheduleUpdate();
    const handleWindowMove = (event) => {
      updateRotationFromDrag(event.clientX, event.clientY);
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
      endDrag();
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
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("pointerleave", handleWindowLeave);
    window.addEventListener("blur", handleWindowLeave);
    return () => {
      window.removeEventListener("pointermove", handleWindowMove);
      window.removeEventListener("mousemove", handleWindowMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("pointerleave", handleWindowLeave);
      window.removeEventListener("blur", handleWindowLeave);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [endDrag, scheduleUpdate, updateRotationFromDrag]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleInspectorMove = (event) => {
      if (!inspectorDragRef.current.active) {
        return;
      }
      const viewer = viewerRef.current;
      const index = inspectorDragRef.current.index;
      if (!viewer || index === null || index === undefined) {
        return;
      }
      const panel = inspectorPanelRefs.current[index];
      if (!panel) {
        return;
      }
      const viewerRect = viewer.getBoundingClientRect();
      const margin = 16;
      const dx = event.clientX - inspectorDragRef.current.startX;
      const dy = event.clientY - inspectorDragRef.current.startY;
      if (!inspectorDragRef.current.moved && Math.hypot(dx, dy) < 6) {
        return;
      }
      inspectorDragRef.current.moved = true;
      const nextX = clamp(
        inspectorDragRef.current.startTranslateX + dx,
        margin,
        viewerRect.width - inspectorDragRef.current.width - margin
      );
      const nextY = clamp(
        inspectorDragRef.current.startTranslateY + dy,
        margin,
        viewerRect.height - inspectorDragRef.current.height - margin
      );
      inspectorPositionsRef.current.set(index, { x: nextX, y: nextY });
      updateInspectorLayout();
    };

    const handleInspectorEnd = () => {
      if (!inspectorDragRef.current.active) {
        return;
      }
      const index = inspectorDragRef.current.index;
      if (index !== null && index !== undefined) {
        if (!inspectorDragRef.current.moved) {
          inspectorPositionsRef.current.delete(index);
        }
        inspectorPanelRefs.current[index]?.classList.remove("is-dragging");
      }
      inspectorDragRef.current.active = false;
      inspectorDragRef.current.index = null;
    };

    window.addEventListener("pointermove", handleInspectorMove);
    window.addEventListener("pointerup", handleInspectorEnd);
    window.addEventListener("pointercancel", handleInspectorEnd);
    window.addEventListener("blur", handleInspectorEnd);
    return () => {
      window.removeEventListener("pointermove", handleInspectorMove);
      window.removeEventListener("pointerup", handleInspectorEnd);
      window.removeEventListener("pointercancel", handleInspectorEnd);
      window.removeEventListener("blur", handleInspectorEnd);
    };
  }, [updateInspectorLayout]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!inspectedIndices.length) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(updateInspectorLayout);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [inspectedIndices, updateInspectorLayout]);

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
      if (dragRef.current.lastDragAt && Date.now() - dragRef.current.lastDragAt < 240) {
        return;
      }
      const face = faces[index];
      if (!face) {
        return;
      }
      setBaseRotation(FACE_ROTATIONS[face.id] ?? DEFAULT_ROTATION);
      setInspectedIndices((current) => {
        if (current.includes(index)) {
          inspectorPositionsRef.current.delete(index);
          if (inspectorDragRef.current.index === index) {
            inspectorDragRef.current.active = false;
            inspectorDragRef.current.index = null;
            inspectorPanelRefs.current[index]?.classList.remove("is-dragging");
          }
          return current.filter((item) => item !== index);
        }
        return [...current, index];
      });
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
  const diffusionLabel =
    diffusionAverage?.hex ||
    (diffusionStatus === "loading" ? "Calculating..." : "n/a");
  const diffusionSwatch = diffusionAverage?.hex || "#f7f2e8";
  const currentFloorSumEth = useMemo(() => {
    const override = toNumber(cube?.currentFloorSumEth);
    if (override != null) {
      return override;
    }
    return faces.reduce((sum, face) => {
      const value = toNumber(face.floorEth);
      return sum + (value ?? 0);
    }, 0);
  }, [cube?.currentFloorSumEth, faces]);
  const currentFeingehalt = currentFloorSumEth / 10;
  const mintedFeingehalt = toNumber(cube?.mintPriceEth) ?? currentFeingehalt;
  const deltaFeingehalt =
    mintedFeingehalt != null ? mintedFeingehalt - currentFeingehalt : null;
  const mintedFeingehaltLabel =
    mintedFeingehalt != null ? formatFloorValue(mintedFeingehalt) : "n/a";
  const deltaFeingehaltLabel = formatSignedValue(deltaFeingehalt);

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
    const exportEdgeColor = edgeColor || "rgba(27, 23, 19, 0.55)";
    const exportEdgeGlow = edgeGlow || "rgba(27, 23, 19, 0.35)";

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
        --cube-user-x: 0deg;
        --cube-user-y: 0deg;
        --cube-tilt-x: 0deg;
        --cube-tilt-y: 0deg;
        --cube-shadow-x: 0px;
        --cube-shadow-y: 0px;
        --cube-edge-color: ${exportEdgeColor};
        --cube-edge-glow: ${exportEdgeGlow};
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
      .paper-cube-link {
        position: relative;
        width: var(--cube-size);
        height: var(--cube-size);
        display: grid;
        place-items: center;
        transform-style: preserve-3d;
        cursor: grab;
      }
      .paper-cube-link:active { cursor: grabbing; }
      .paper-cube-shadow {
        position: absolute;
        width: 80%;
        height: 22%;
        left: 50%;
        top: 72%;
        transform: translate(
          calc(-50% + var(--cube-shadow-x)),
          calc(var(--cube-shadow-y))
        );
        background: radial-gradient(
          ellipse at center,
          rgba(0, 0, 0, 0.45),
          transparent 70%
        );
        filter: blur(12px);
        opacity: 0.7;
      }
      .paper-cube {
        position: relative;
        width: var(--cube-size);
        height: var(--cube-size);
        transform-style: preserve-3d;
        transform: rotateX(calc(var(--cube-base-x) + var(--cube-user-x)))
          rotateY(calc(var(--cube-base-y) + var(--cube-user-y)));
        transition: transform 0.12s ease-out;
      }
      .paper-cube-face {
        position: absolute;
        inset: 0;
        background-color: #d8d2c8;
        background-image: var(--face-image);
        background-size: cover;
        background-position: center;
        border: 1px solid var(--cube-edge-color);
        box-shadow: inset 0 0 26px rgba(0, 0, 0, 0.35), 0 0 10px var(--cube-edge-glow);
        backface-visibility: hidden;
      }
      .paper-face-front { transform: translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-back { transform: rotateY(180deg) translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-right { transform: rotateY(90deg) translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-left { transform: rotateY(-90deg) translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-top { transform: rotateX(90deg) translateZ(calc(var(--cube-size) / 2)); }
      .paper-face-bottom { transform: rotateX(-90deg) translateZ(calc(var(--cube-size) / 2)); }
    `;

    const exportSubhead = displayDescription
      ? `<p class=\"paper-subhead\">${escapeHtml(displayDescription)}</p>`
      : "";

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
            ${exportSubhead}
          </header>
          <div class=\"paper-stage\">
            <div class=\"paper-cube-link\" aria-label=\"Cubixles cube\">
              <div class=\"paper-cube-shadow\" aria-hidden=\"true\"></div>
              <div class=\"paper-cube\">${exportFaces}</div>
            </div>
          </div>
        </main>
        <script>
          (() => {
            const viewer = document.querySelector(".paper-viewer");
            const cubeLink = document.querySelector(".paper-cube-link");
            if (!viewer || !cubeLink) {
              return;
            }
            let active = false;
            let startX = 0;
            let startY = 0;
            let startRotX = 0;
            let startRotY = 0;
            let rotX = 0;
            let rotY = 0;
            const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
            const updateVars = () => {
              viewer.style.setProperty("--cube-user-x", rotX + "deg");
              viewer.style.setProperty("--cube-user-y", rotY + "deg");
            };
            const onMove = (event) => {
              if (!active) {
                return;
              }
              const dx = event.clientX - startX;
              const dy = event.clientY - startY;
              rotX = clamp(startRotX + dy * 0.35, -80, 80);
              rotY = startRotY + dx * 0.45;
              updateVars();
            };
            cubeLink.addEventListener("pointerdown", (event) => {
              active = true;
              startX = event.clientX;
              startY = event.clientY;
              startRotX = rotX;
              startRotY = rotY;
              if (cubeLink.setPointerCapture) {
                cubeLink.setPointerCapture(event.pointerId);
              }
            });
            window.addEventListener("pointermove", onMove, { passive: true });
            window.addEventListener("pointerup", () => {
              active = false;
            });
            window.addEventListener("pointercancel", () => {
              active = false;
            });
            updateVars();
          })();
        </script>
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
  }, [cube, displayDescription, edgeColor, edgeGlow, faces, truncatedTokenId]);

  if (!cube) {
    return null;
  }

  return (
    <main
      ref={viewerRef}
      className="paper-viewer"
      style={{
        "--cube-base-x": baseRotation.x,
        "--cube-base-y": baseRotation.y,
        ...(edgeColor
          ? {
              "--cube-edge-color": edgeColor,
              "--cube-edge-glow": edgeGlow || edgeColor,
            }
          : null),
      }}
    >
      <header className="paper-header">
        <p className="paper-eyebrow">Token viewer 02</p>
        <h1 className="paper-title" title={cube.tokenId}>
          <CubixlesLogo className="cubixles-logo-inline" />
          Token {truncatedTokenId}
        </h1>
        {displayDescription ? (
          <p className="paper-subhead">
            <CubixlesText text={displayDescription} />
          </p>
        ) : null}
        {isMismatch && (
          <p className="paper-note" title={cube.tokenId}>
            Showing minted cube for {truncatedTokenId}.
          </p>
        )}
        <div className="paper-actions">
          {allowExport ? (
            <button
              type="button"
              className="paper-export-button"
              onClick={handleExportHtml}
            >
              Export to HTML
            </button>
          ) : null}
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
          onPointerDown={startDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
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
              const isActive = inspectedIndices.includes(index);
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
                  onPointerUp={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (dragRef.current.moved) {
                      return;
                    }
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

      {inspectedIndices.map((index) => {
        const inspectedFace = faces[index];
        if (!inspectedFace) {
          return null;
        }
        const floorLabel = formatFloorValue(inspectedFace.floorEth);
        const floorText = floorLabel === "n/a" ? "n/a" : `${floorLabel} ETH`;
        return (
          <div key={`inspector-${inspectedFace.id}`}>
            <div
              ref={(node) => {
                inspectorLineRefs.current[index] = node;
              }}
              className="paper-inspector-line"
              aria-hidden="true"
            />
            <aside
              ref={(node) => {
                inspectorPanelRefs.current[index] = node;
              }}
              className="paper-inspector"
              role="dialog"
              aria-label={`Inspect ${inspectedFace.label}`}
            >
              <div
                className="paper-inspector-header"
                onPointerDown={(event) => startInspectorDrag(index, event)}
              >
                <div>
                  <span className="paper-inspector-eyebrow">
                    {FACE_NAMES[inspectedFace.id] || "Face"}
                  </span>
                  <h2 className="paper-inspector-title">{inspectedFace.title}</h2>
                </div>
                <button
                  type="button"
                  className="paper-inspector-close"
                  onClick={() => handleFaceInspect(index)}
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
          </div>
        );
      })}

      {faces.length > 0 && (
        <div className="paper-face-map" role="group" aria-label="Cube faces">
          {faces.map((face, index) => {
            const isActive = inspectedIndices.includes(index);
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

      <aside className="paper-fee-hud" aria-label="Feingehalt">
        <span className="paper-fee-label">Feingehalt</span>
        <span className="paper-fee-value">
          {mintedFeingehaltLabel === "n/a" ? "n/a" : `${mintedFeingehaltLabel} ETH`}
        </span>
        <span className="paper-fee-sub">
          Delta Feingehalt:{" "}
          {deltaFeingehaltLabel === "n/a" ? "n/a" : `${deltaFeingehaltLabel} ETH`}
        </span>
      </aside>

      {diffusionStatus !== "idle" && (
        <aside
          className={`paper-hud${hudOpen ? "" : " is-collapsed"}`}
          aria-label="Diffusion HUD"
        >
          <button
            type="button"
            className="paper-hud-toggle"
            aria-expanded={hudOpen}
            onClick={() => setHudOpen((open) => !open)}
          >
            Diffusion HUD
          </button>
          <div className="paper-hud-body">
            <div className="paper-hud-row">
              <span className="paper-hud-label">Average</span>
              <span className="paper-hud-value">{diffusionLabel}</span>
              <span
                className="paper-hud-swatch"
                style={{ backgroundColor: diffusionSwatch }}
                aria-hidden="true"
              />
            </div>
            <span className="paper-hud-note">Sampled from face images.</span>
          </div>
        </aside>
      )}

      {qrAddress && qrDataUrl && (
        <aside
          className={`paper-qr${qrOpen ? "" : " is-collapsed"}`}
          aria-label="Wallet QR"
        >
          <button
            type="button"
            className="paper-qr-toggle"
            aria-expanded={qrOpen}
            onClick={() => setQrOpen((open) => !open)}
          >
            Wallet QR
          </button>
          <div className="paper-qr-body">
            <img
              src={qrDataUrl}
              alt={`Wallet QR for ${truncateMiddle(qrAddress)}`}
              className="paper-qr-image"
            />
            <span className="paper-qr-address">{truncateMiddle(qrAddress)}</span>
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
          <span>{formatAddress(cube.mintedBy)}</span>
        </div>
      </aside>
    </main>
  );
}
