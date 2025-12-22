import { config } from "./app/app-config.js";
import { state } from "./app/app-state.js";
import { resolveUrl, fillFaceTextures } from "./app/app-utils.js";
import { applyLights } from "./app/app-scene.js";
import {
  preloadBackground,
  initBackdrop,
  drawBackdrop,
  drawForeground,
} from "./app/app-backdrop.js";
import { drawTexturedFaces, drawGlassShell } from "./app/app-cube.js";
import { buildEdges, drawInkEdges } from "./app/app-edges.js";
import {
  onMousePressed,
  onMouseDragged,
  onMouseReleased,
  onMouseWheel,
  onTouchStarted,
  onTouchMoved,
  onTouchEnded,
} from "./app/app-interaction.js";
import { bindUi } from "./app/app-ui.js";
import { fetchBackgroundDataUrl } from "./app/app-exporter.js";
import { initWalletUi } from "./wallet/wallet-ui.js";
import { Buffer } from "buffer";

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

window.preload = function preload() {
  state.defaultTextures = config.sourceUrls.map((url) =>
    loadImage(resolveUrl(url))
  );
  preloadBackground();
};

window.setup = function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  pixelDensity(1);
  textureMode(NORMAL);
  noStroke();
  initBackdrop();
  buildEdges();
  state.faceTextures = fillFaceTextures(state.defaultTextures);
  bindUi();
  initWalletUi();
  fetchBackgroundDataUrl();
};

window.draw = function draw() {
  drawBackdrop();
  applyLights();
  camera(0, 0, state.zoom, 0, 0, 0, 0, 1, 0);
  rotateX(state.rotX);
  rotateY(state.rotY);
  noStroke();
  drawTexturedFaces();
  drawGlassShell();
  drawInkEdges();
  drawForeground();
};

window.mousePressed = function mousePressed() {
  onMousePressed();
};

window.mouseDragged = function mouseDragged() {
  onMouseDragged();
};

window.mouseReleased = function mouseReleased() {
  onMouseReleased();
};

window.mouseWheel = function mouseWheel(event) {
  return onMouseWheel(event);
};

window.touchStarted = function touchStarted() {
  return onTouchStarted();
};

window.touchMoved = function touchMoved() {
  return onTouchMoved();
};

window.touchEnded = function touchEnded() {
  return onTouchEnded();
};

window.windowResized = function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initBackdrop();
};
