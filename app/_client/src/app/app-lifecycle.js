import { config } from "./app-config.js";
import { state } from "./app-state.js";
import {
  resolveUrl,
  fillFaceTextures,
  createFrostedTexture,
} from "./app-utils.js";
import { applyLights } from "./app-scene.js";
import {
  preloadBackground,
  initBackdrop,
  drawBackdrop,
  drawForeground,
} from "./app-backdrop.js";
import { initTileSwarm, drawTileSwarm, resizeTileSwarm } from "./app-tile-swarm.js";
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

function preloadApp() {
  state.defaultTextures = config.sourceUrls.map((url) =>
    loadImage(resolveUrl(url))
  );
  preloadBackground();
}

function setupApp() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  textureMode(NORMAL);
  noStroke();
  state.frostedTexture = createFrostedTexture();
  initBackdrop();
  buildEdges();
  state.faceTextures = fillFaceTextures(state.defaultTextures);
  initUiRoot();
  fetchBackgroundDataUrl();
  initTileSwarm();
}

function drawApp() {
  drawBackdrop();
  applyRotationInertia();
  applyLights();
  camera(0, 0, state.zoom, 0, 0, 0, 0, 1, 0);
  rotateX(state.rotX);
  rotateY(state.rotY);
  noStroke();
  drawTexturedFaces();
  drawGlassShell();
  drawInkEdges();
  drawForeground();
  drawTileSwarm();
}

function resizeApp() {
  resizeCanvas(windowWidth, windowHeight);
  initBackdrop();
  resizeTileSwarm();
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
