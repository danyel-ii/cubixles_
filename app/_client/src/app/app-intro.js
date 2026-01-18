import { config } from "./app-config.js";
import { state } from "./app-state.js";

const INTRO_DURATION_MS = 4400;
const INTRO_HOLD_MS = 750;
const INTRO_FADE_START = 0.55;
const INTRO_FADE_END = 0.92;
const INTRO_TEXTURE_START = 0.42;
const INTRO_TEXTURE_END = 0.86;
const INTRO_GLASS_START = 0.62;
const INTRO_EDGE_START = 0.28;
const INTRO_EDGE_END = 0.78;

const TILE_TEXTURE_SIZE = 320;
const TILE_GRID = 16;
const TILE_GAP_RATIO = 0.08;

const FALLBACK_COLORS = [
  "#EA7B7B",
  "#D25353",
  "#9E3B3B",
  "#FFEAD3",
  "#2D3C59",
  "#94A378",
  "#E5BA41",
  "#D1855C",
  "#061E29",
  "#1D546D",
  "#5F9598",
  "#F3F4F4",
  "#BBE0EF",
  "#161E54",
  "#F16D34",
  "#FF986A",
  "#FFFDE1",
  "#FBE580",
  "#93BD57",
  "#980404",
];

let paletteLines = null;
let introInitialized = false;

export function preloadIntroPalette() {
  paletteLines = loadStrings(
    "/assets/generative_plot/pallette.csv",
    () => {},
    () => {
      paletteLines = null;
    }
  );
}

export function initIntro() {
  if (introInitialized) {
    return;
  }
  introInitialized = true;

  const palette = parsePaletteLines(paletteLines);
  const tileTextures = buildTileTextures(palette);
  const reduceMotion = prefersReducedMotion();
  const skipIntro = shouldSkipIntro();
  const isTokenView =
    typeof document !== "undefined" &&
    document.body.classList.contains("is-token-view");
  const isBuilder =
    typeof document !== "undefined" && document.body.classList.contains("is-builder");
  const duration = reduceMotion ? 1200 : INTRO_DURATION_MS;
  const zoomStart = Math.max(config.zoom.max + 260, config.zoom.initial + 380);

  state.intro = {
    active: !reduceMotion && !isTokenView && !isBuilder && !skipIntro,
    duration,
    startTime: typeof millis === "function" ? millis() : Date.now(),
    zoomStart,
    zoomEnd: config.zoom.initial,
    baseRotX: state.rotX,
    baseRotY: state.rotY,
    tileTextures,
    faceTransforms: buildFaceTransforms(),
    holdStart: null,
    paletteCount: palette.length,
  };

  state.rotVelX = 0;
  state.rotVelY = 0;

  if (!state.intro.active) {
    state.zoom = config.zoom.initial;
    if (typeof document !== "undefined") {
      document.body.classList.remove("is-intro");
    }
    dispatchIntroComplete();
    return;
  }

  state.zoom = zoomStart;
  if (typeof document !== "undefined") {
    document.body.classList.add("is-intro");
  }
}

export function updateIntroState() {
  const intro = state.intro;
  if (!intro || !intro.active) {
    return null;
  }
  const now = typeof millis === "function" ? millis() : Date.now();
  const elapsed = Math.max(0, now - intro.startTime);
  const progress = clamp(elapsed / intro.duration, 0, 1);
  intro.progress = progress;

  const zoomEase = easeInOutCubic(progress);
  state.zoom = lerp(intro.zoomStart, intro.zoomEnd, zoomEase);

  const t = elapsed * 0.001;
  state.rotX = intro.baseRotX + Math.sin(t * 0.72) * 0.08;
  state.rotY = intro.baseRotY + t * 0.32;
  state.rotVelX = 0;
  state.rotVelY = 0;

  const tileAlpha = 1 - smoothstep(INTRO_FADE_START, INTRO_FADE_END, progress);
  const texturedAlpha = smoothstep(INTRO_TEXTURE_START, INTRO_TEXTURE_END, progress);
  const glassAlpha = smoothstep(INTRO_GLASS_START, 1, progress);
  const edgeAlpha = smoothstep(INTRO_EDGE_START, INTRO_EDGE_END, progress);

  if (progress >= 1) {
    if (!intro.holdStart) {
      intro.holdStart = now;
      state.zoom = intro.zoomEnd;
    }
    if (now - intro.holdStart >= INTRO_HOLD_MS) {
      finalizeIntro(intro);
      return null;
    }
    return {
      active: true,
      tileAlpha: 0,
      texturedAlpha: 1,
      glassAlpha: 1,
      edgeAlpha: 1,
      progress: 1,
    };
  }

  return {
    active: true,
    tileAlpha,
    texturedAlpha,
    glassAlpha,
    edgeAlpha,
    progress,
  };
}

export function drawIntroCube(introState) {
  const intro = state.intro;
  if (!intro || !intro.tileTextures || !introState) {
    return;
  }
  const alpha = clamp(introState.tileAlpha, 0, 1);
  if (alpha <= 0) {
    return;
  }
  const faceSize = config.cubeSize * 0.98;
  intro.faceTransforms.forEach((transform, index) => {
    drawTileFace(intro.tileTextures[index], transform, faceSize, alpha);
  });
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function shouldSkipIntro() {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.__CUBIXLES_TEST_HOOKS__ || window.__CUBIXLES_SKIP_INTRO__) {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  if (!params.has("skipIntro")) {
    return false;
  }
  const value = params.get("skipIntro");
  if (value === null || value === "") {
    return true;
  }
  return value !== "0" && value.toLowerCase() !== "false";
}

function finalizeIntro(intro) {
  intro.active = false;
  state.zoom = intro.zoomEnd;
  if (typeof document !== "undefined") {
    document.body.classList.remove("is-intro");
  }
  dispatchIntroComplete();
}

function dispatchIntroComplete() {
  if (typeof document === "undefined") {
    return;
  }
  document.dispatchEvent(new CustomEvent("intro-complete"));
}

function buildFaceTransforms() {
  const half = config.cubeSize / 2 - 1;
  return [
    { x: half, y: 0, z: 0, rx: 0, ry: HALF_PI, rz: 0, mirrorX: false },
    { x: -half, y: 0, z: 0, rx: 0, ry: -HALF_PI, rz: 0, mirrorX: true },
    { x: 0, y: half, z: 0, rx: HALF_PI, ry: 0, rz: 0, mirrorX: true },
    { x: 0, y: -half, z: 0, rx: -HALF_PI, ry: 0, rz: 0, mirrorX: false },
    { x: 0, y: 0, z: half, rx: 0, ry: 0, rz: 0, mirrorX: false },
    { x: 0, y: 0, z: -half, rx: 0, ry: PI, rz: 0, mirrorX: true },
  ];
}

function drawTileFace(textureImg, { x, y, z, rx, ry, rz, mirrorX }, size, alpha) {
  if (!textureImg) {
    return;
  }
  push();
  translate(x, y, z);
  rotateX(rx);
  rotateY(ry);
  rotateZ(rz);
  if (mirrorX) {
    scale(-1, 1, 1);
  }
  texture(textureImg);
  tint(255, Math.round(255 * alpha));
  plane(size, size);
  pop();
}

function buildTileTextures(palette) {
  const faces = [
    { shade: -0.08 },
    { shade: -0.14 },
    { shade: -0.18 },
    { shade: 0.08 },
    { shade: 0.04 },
    { shade: -0.12 },
  ];
  return faces.map((face) => createTileTexture(palette, face.shade));
}

function createTileTexture(palette, shade) {
  const g = createGraphics(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE);
  g.pixelDensity(1);
  g.clear();
  g.background(10, 12, 16, 255);
  g.noStroke();
  const tileSize = TILE_TEXTURE_SIZE / TILE_GRID;
  const gap = tileSize * TILE_GAP_RATIO;
  const radius = tileSize * 0.18;

  for (let y = 0; y < TILE_GRID; y += 1) {
    for (let x = 0; x < TILE_GRID; x += 1) {
      const hex = palette[Math.floor(Math.random() * palette.length)] || "#F5F2F2";
      const rgb = applyShade(hexToRgb(hex), shade + (Math.random() - 0.5) * 0.08);
      g.fill(rgb.r, rgb.g, rgb.b);
      g.rect(
        x * tileSize + gap,
        y * tileSize + gap,
        tileSize - gap * 2,
        tileSize - gap * 2,
        radius
      );
    }
  }

  const ctx = g.drawingContext;
  const gradient = ctx.createLinearGradient(0, 0, TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.1)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.18)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE);

  return g;
}

function parsePaletteLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    return FALLBACK_COLORS;
  }
  const colors = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    const parts = line.split(",");
    const hexField = parts[2];
    if (!hexField) {
      continue;
    }
    hexField.split(";").forEach((hex) => {
      const trimmed = hex.trim();
      if (trimmed.startsWith("#")) {
        colors.push(trimmed.toUpperCase());
      }
    });
  }
  return colors.length ? colors : FALLBACK_COLORS;
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function applyShade(rgb, shade) {
  const delta = shade * 255;
  return {
    r: clamp(Math.round(rgb.r + delta), 0, 255),
    g: clamp(Math.round(rgb.g + delta), 0, 255),
    b: clamp(Math.round(rgb.b + delta), 0, 255),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}
