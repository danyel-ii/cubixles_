import { config } from "./app-config.js";
import { state } from "./app-state.js";

function isBuilderBackdrop() {
  if (typeof document === "undefined") {
    return false;
  }
  return document.body.classList.contains("is-builder");
}

function drawPaperBackdrop(backdrop) {
  const width = backdrop.width;
  const height = backdrop.height;
  backdrop.push();
  backdrop.clear();
  backdrop.background(247, 242, 232);
  backdrop.stroke(30, 45, 70, 41);
  backdrop.strokeWeight(1);
  for (let x = 0; x <= width; x += 24) {
    backdrop.line(x, 0, x, height);
  }
  for (let y = 0; y <= height; y += 24) {
    backdrop.line(0, y, width, y);
  }
  backdrop.stroke(30, 45, 70, 77);
  for (let x = 0; x <= width; x += 120) {
    backdrop.line(x, 0, x, height);
  }
  for (let y = 0; y <= height; y += 120) {
    backdrop.line(0, y, width, y);
  }
  backdrop.stroke(208, 88, 88, 179);
  backdrop.strokeWeight(2);
  backdrop.line(63, 0, 63, height);
  backdrop.pop();
}

export function preloadBackground() {
  if (isBuilderBackdrop()) {
    state.bgImage = null;
    return;
  }
  state.bgImage = loadImage(
    config.backgroundUrl,
    () => {},
    () => {
      state.bgImage = null;
    }
  );
}

export function initBackdrop() {
  state.backdrop = createGraphics(windowWidth, windowHeight);
  updateBackdrop();
}

export function updateBackdrop() {
  const backdrop = state.backdrop;
  if (!backdrop) {
    return;
  }
  if (isBuilderBackdrop()) {
    drawPaperBackdrop(backdrop);
    return;
  }
  backdrop.clear();
  const ctx = backdrop.drawingContext;
  const gradient = ctx.createLinearGradient(0, 0, backdrop.width, backdrop.height);
  gradient.addColorStop(0, "#0b1015");
  gradient.addColorStop(0.5, "#131923");
  gradient.addColorStop(1, "#0c0f14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, backdrop.width, backdrop.height);
}

export function drawBackdrop() {
  const bgImage = state.bgImage;
  if (bgImage && !isBuilderBackdrop()) {
    const t = frameCount * 0.0016;
    push();
    resetMatrix();
    camera(0, 0, state.zoom, 0, 0, 0, 0, 1, 0);
    noStroke();
    texture(bgImage);
    tint(255, 180);
    rotateY(t * 0.7);
    rotateX(-0.2 + sin(t * 0.9) * 0.05);
    scale(-1, 1, 1);
    sphere(1700, 48, 32);
    pop();

    push();
    noStroke();
    texture(bgImage);
    tint(255, 90);
    rotateY(-t * 1.2);
    rotateX(0.25 + sin(t * 1.3) * 0.04);
    scale(-1, 1, 1);
    sphere(1250, 36, 24);
    pop();

    push();
    noStroke();
    texture(bgImage);
    tint(255, 65);
    rotateY(t * 1.4);
    rotateX(0.4 + sin(t * 0.6) * 0.08);
    translate(0, 0, -900);
    plane(width * 3, height * 3);
    pop();

    push();
    noStroke();
    texture(bgImage);
    tint(255, 80);
    rotateY(t * 1.1);
    rotateX(0.15);
    translate(0, 0, 620);
    rotateY(t * 0.4);
    plane(width * 2.4, height * 2.4);
    pop();
    return;
  }

  push();
  noStroke();
  texture(state.backdrop);
  translate(0, 0, -900);
  plane(width * 2, height * 2);
  pop();
}

export function drawForeground() {
  if (isBuilderBackdrop()) {
    return;
  }
  const bgImage = state.bgImage;
  if (!bgImage) {
    return;
  }
  const t = frameCount * 0.0016;
  push();
  resetMatrix();
  camera(0, 0, state.zoom, 0, 0, 0, 0, 1, 0);
  noStroke();
  texture(bgImage);
  tint(255, 95);
  rotateY(t * 1.4);
  rotateX(0.12 + sin(t * 1.1) * 0.05);
  translate(0, 0, 320);
  rotateY(-t * 0.6);
  plane(width * 2.0, height * 2.0);
  pop();
}
