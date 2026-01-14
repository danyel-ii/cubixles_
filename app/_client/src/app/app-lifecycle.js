import { config } from "./app-config.js";
import { state } from "./app-state.js";
import { fillFaceTextures, createFrostedTexture } from "./app-utils.js";
import { applyLights } from "./app-scene.js";
import {
  preloadBackground,
  initBackdrop,
  drawBackdrop,
  drawForeground,
} from "./app-backdrop.js";
import { initTileSwarm, drawTileSwarm, resizeTileSwarm } from "./app-tile-swarm.js";
import {
  preloadIntroPalette,
  initIntro,
  updateIntroState,
  drawIntroCube,
} from "./app-intro.js";
import { drawTexturedFaces, drawGlassShell } from "./app-cube.js";
import { buildEdges, drawInkEdges } from "./app-edges.js";
import {
  onMousePressed,
  onMouseDragged,
  onMouseReleased,
  onMouseWheel,
  onTouchStarted,
  onTouchMoved,
  onTouchEnded,
  applyRotationInertia,
} from "./app-interaction.js";
import { fetchBackgroundDataUrl } from "./app-exporter.js";
import { initUiRoot } from "../ui/ui-root.js";
import { buildImageCandidates } from "../shared/utils/uri";

const TOOLTIP_SWARM_ENABLED = false;
let defaultTexturesLoading = false;

function preloadApp() {
  preloadBackground();
  preloadIntroPalette();
}

function loadDefaultTextures() {
  if (defaultTexturesLoading) {
    return;
  }
  const urlSets = config.sourceUrls.map((url) => buildImageCandidates(url));
  if (!urlSets.length) {
    return;
  }
  defaultTexturesLoading = true;
  Promise.all(
    urlSets.map(
      (candidates) =>
        new Promise((resolve) => {
          const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
          const tryLoad = (index) => {
            if (index >= list.length) {
              resolve(null);
              return;
            }
            const url = list[index];
            loadImage(
              url,
              (img) => resolve(img),
              () => tryLoad(index + 1)
            );
          };
          tryLoad(0);
        })
    )
  ).then((images) => {
    const loaded = images.filter(Boolean);
    if (!loaded.length) {
      return;
    }
    const fallback = loaded[0] || state.frostedTexture;
    const normalized = images.map((img) => img || fallback).filter(Boolean);
    state.defaultTextures = normalized;
    const hasSelection = Array.isArray(state.nftSelection) && state.nftSelection.length > 0;
    if (!state.currentCubeTokenId && !hasSelection) {
      state.faceTextures = fillFaceTextures(normalized);
    }
  });
}

function setupApp() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  textureMode(NORMAL);
  noStroke();
  state.frostedTexture = createFrostedTexture();
  initBackdrop();
  buildEdges();
  state.faceTextures = fillFaceTextures([state.frostedTexture]);
  loadDefaultTextures();
  initIntro();
  initUiRoot();
  fetchBackgroundDataUrl();
  if (TOOLTIP_SWARM_ENABLED) {
    initTileSwarm();
  }
}

function drawApp() {
  drawBackdrop();
  const introState = updateIntroState();
  if (!introState) {
    applyRotationInertia();
  }
  applyLights();
  camera(0, 0, state.zoom, 0, 0, 0, 0, 1, 0);
  rotateX(state.rotX);
  rotateY(state.rotY);
  noStroke();
  if (introState) {
    drawIntroCube(introState);
    if (introState.texturedAlpha > 0) {
      drawTexturedFaces(introState.texturedAlpha);
    }
    if (introState.glassAlpha > 0) {
      drawGlassShell(introState.glassAlpha);
    }
    if (introState.edgeAlpha > 0) {
      drawInkEdges(introState.edgeAlpha);
    }
  } else {
    drawTexturedFaces();
    drawGlassShell();
    drawInkEdges();
  }
  drawForeground();
  if (TOOLTIP_SWARM_ENABLED) {
    drawTileSwarm();
  }
}

function resizeApp() {
  resizeCanvas(windowWidth, windowHeight);
  initBackdrop();
  if (TOOLTIP_SWARM_ENABLED) {
    resizeTileSwarm();
  }
}

function handleMouseWheel(event) {
  return onMouseWheel(event);
}

function handleTouchStarted() {
  return onTouchStarted();
}

function handleTouchMoved() {
  return onTouchMoved();
}

function handleTouchEnded() {
  return onTouchEnded();
}

export function registerAppLifecycle() {
  window.preload = preloadApp;
  window.setup = setupApp;
  window.draw = drawApp;
  window.mousePressed = onMousePressed;
  window.mouseDragged = onMouseDragged;
  window.mouseReleased = onMouseReleased;
  window.mouseWheel = handleMouseWheel;
  window.touchStarted = handleTouchStarted;
  window.touchMoved = handleTouchMoved;
  window.touchEnded = handleTouchEnded;
  window.windowResized = resizeApp;
}
