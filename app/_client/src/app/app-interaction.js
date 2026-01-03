import { config } from "./app-config.js";
import { state } from "./app-state.js";

const ROT_SENSITIVITY = 0.006;
const ROT_DAMPING = 0.94;
const ROT_EPSILON = 0.0001;
const ROT_CLAMP = Math.PI / 2 - 0.08;

export function onMousePressed() {
  if (isWalletModalOpen()) {
    return false;
  }
  if (isUiPointed()) {
    return true;
  }
  state.lastMouse = { x: mouseX, y: mouseY };
  state.isDragging = true;
}

export function onMouseDragged() {
  if (isWalletModalOpen()) {
    return false;
  }
  if (isUiPointed()) {
    return true;
  }
  if (!state.lastMouse) {
    return;
  }
  const dx = mouseX - state.lastMouse.x;
  const dy = mouseY - state.lastMouse.y;
  updateRotation(dx, dy);
  state.lastMouse = { x: mouseX, y: mouseY };
}

export function onMouseReleased() {
  if (isWalletModalOpen()) {
    return false;
  }
  if (isUiPointed()) {
    return true;
  }
  state.lastMouse = null;
  state.isDragging = false;
}

export function onMouseWheel(event) {
  if (isWalletModalOpen()) {
    return false;
  }
  if (isUiPointed()) {
    return true;
  }
  state.zoom = constrain(
    state.zoom + event.delta * 0.4,
    config.zoom.min,
    config.zoom.max
  );
  return false;
}

export function onTouchStarted(event) {
  if (isOverlayActive() || isUiTarget(event) || isWalletModalActive() || isWalletModalOpen()) {
    return true;
  }
  if (touches.length === 2) {
    state.pinchStartDist = dist(
      touches[0].x,
      touches[0].y,
      touches[1].x,
      touches[1].y
    );
    state.pinchStartZoom = state.zoom;
    state.isDragging = false;
  } else if (touches.length === 1) {
    state.lastMouse = { x: touches[0].x, y: touches[0].y };
    state.isDragging = true;
  }
  return false;
}

export function onTouchMoved(event) {
  if (isOverlayActive() || isUiTarget(event) || isWalletModalActive() || isWalletModalOpen()) {
    return true;
  }
  if (touches.length === 2) {
    const currentDist = dist(
      touches[0].x,
      touches[0].y,
      touches[1].x,
      touches[1].y
    );
    if (state.pinchStartDist !== null) {
      const delta = currentDist - state.pinchStartDist;
      state.zoom = constrain(
        state.pinchStartZoom - delta * 1.2,
        config.zoom.min,
        config.zoom.max
      );
    }
    state.isDragging = false;
  } else if (touches.length === 1 && state.lastMouse) {
    const dx = touches[0].x - state.lastMouse.x;
    const dy = touches[0].y - state.lastMouse.y;
    updateRotation(dx, dy);
    state.lastMouse = { x: touches[0].x, y: touches[0].y };
  }
  return false;
}

export function onTouchEnded(event) {
  if (isOverlayActive() || isUiTarget(event) || isWalletModalActive() || isWalletModalOpen()) {
    return true;
  }
  if (touches.length < 2) {
    state.pinchStartDist = null;
    state.pinchStartZoom = null;
  }
  if (touches.length === 0) {
    state.lastMouse = null;
    state.isDragging = false;
  }
  return false;
}

export function applyRotationInertia() {
  if (state.isDragging) {
    return;
  }
  if (Math.abs(state.rotVelX) < ROT_EPSILON && Math.abs(state.rotVelY) < ROT_EPSILON) {
    state.rotVelX = 0;
    state.rotVelY = 0;
    return;
  }
  state.rotX += state.rotVelX;
  state.rotY += state.rotVelY;
  state.rotVelX *= ROT_DAMPING;
  state.rotVelY *= ROT_DAMPING;
  state.rotX = constrain(state.rotX, -ROT_CLAMP, ROT_CLAMP);
}

function isOverlayActive() {
  const overlay = document.getElementById("overlay");
  return Boolean(overlay && !overlay.classList.contains("is-hidden"));
}

function isWalletModalActive() {
  return Boolean(
    document.querySelector(
      "wcm-modal, w3m-modal, .wcm-modal, .w3m-modal, .walletconnect-modal, [data-wcm-modal]"
    )
  );
}

function isWalletModalOpen() {
  if (typeof document === "undefined") {
    return false;
  }
  return document.body.classList.contains("wallet-modal-open");
}

function isUiTarget(event) {
  const target = event?.target;
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest("#ui") ||
      target.closest("#leaderboard") ||
      target.closest("#preview-bar") ||
      target.closest("#overlay")
  );
}

function isUiPointed() {
  if (typeof document === "undefined") {
    return false;
  }
  const el = document.elementFromPoint(mouseX, mouseY);
  if (!el) {
    return false;
  }
  return Boolean(
    el.closest("#ui") ||
      el.closest("#leaderboard") ||
      el.closest("#preview-bar") ||
      el.closest("#overlay") ||
      el.closest(".toast-root") ||
      el.closest(".eth-hud") ||
      el.closest(".less-hud")
  );
}

function updateRotation(dx, dy) {
  state.rotVelY = dx * ROT_SENSITIVITY;
  state.rotVelX = -dy * ROT_SENSITIVITY;
  state.rotY += state.rotVelY;
  state.rotX += state.rotVelX;
  state.rotX = constrain(state.rotX, -ROT_CLAMP, ROT_CLAMP);
}
