import { config } from "./app-config.js";
import { state } from "./app-state.js";

export function onMousePressed() {
  state.lastMouse = { x: mouseX, y: mouseY };
}

export function onMouseDragged() {
  if (!state.lastMouse) {
    return;
  }
  const dx = mouseX - state.lastMouse.x;
  const dy = mouseY - state.lastMouse.y;
  updateRotation(dx, dy);
  state.lastMouse = { x: mouseX, y: mouseY };
}

export function onMouseReleased() {
  state.lastMouse = null;
}

export function onMouseWheel(event) {
  state.zoom = constrain(
    state.zoom + event.delta * 0.4,
    config.zoom.min,
    config.zoom.max
  );
  return false;
}

export function onTouchStarted() {
  if (touches.length === 2) {
    state.pinchStartDist = dist(
      touches[0].x,
      touches[0].y,
      touches[1].x,
      touches[1].y
    );
    state.pinchStartZoom = state.zoom;
  } else if (touches.length === 1) {
    state.lastMouse = { x: touches[0].x, y: touches[0].y };
  }
  return false;
}

export function onTouchMoved() {
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
  } else if (touches.length === 1 && state.lastMouse) {
    const dx = touches[0].x - state.lastMouse.x;
    const dy = touches[0].y - state.lastMouse.y;
    updateRotation(dx, dy);
    state.lastMouse = { x: touches[0].x, y: touches[0].y };
  }
  return false;
}

export function onTouchEnded() {
  if (touches.length < 2) {
    state.pinchStartDist = null;
    state.pinchStartZoom = null;
  }
  if (touches.length === 0) {
    state.lastMouse = null;
  }
  return false;
}

function updateRotation(dx, dy) {
  state.rotY += dx * 0.005;
  state.rotX += dy * 0.005;
  state.rotX = constrain(state.rotX, -PI / 2 + 0.05, PI / 2 - 0.05);
}
