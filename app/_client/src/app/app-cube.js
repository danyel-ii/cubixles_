import { config } from "./app-config.js";
import { state } from "./app-state.js";

export function drawTexturedFaces(alpha = 1) {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  if (clampedAlpha <= 0) {
    return;
  }
  const half = config.cubeSize / 2 - 1;
  const faceSize = config.cubeSize * 0.98;
  const tintAlpha = 245 * clampedAlpha;
  const faces = state.faceTextures;
  const transforms = [
    { x: half, y: 0, z: 0, rx: 0, ry: HALF_PI, rz: 0, mirrorX: false },
    { x: -half, y: 0, z: 0, rx: 0, ry: -HALF_PI, rz: 0, mirrorX: true },
    { x: 0, y: half, z: 0, rx: HALF_PI, ry: 0, rz: 0, mirrorX: true },
    { x: 0, y: -half, z: 0, rx: -HALF_PI, ry: 0, rz: 0, mirrorX: false },
    { x: 0, y: 0, z: half, rx: 0, ry: 0, rz: 0, mirrorX: false },
    { x: 0, y: 0, z: -half, rx: 0, ry: PI, rz: 0, mirrorX: true },
  ];
  transforms.forEach((transform, index) => {
    drawFace(faces[index], transform, faceSize, tintAlpha);
  });
}

function drawFace(img, { x, y, z, rx, ry, rz, mirrorX }, size, alpha) {
  if (!img || state.isLoadingLocal) {
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
  texture(img);
  tint(255, alpha);
  plane(size, size);
  pop();
}

export function drawGlassShell(alpha = 1) {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  if (clampedAlpha <= 0) {
    return;
  }
  push();
  specularMaterial(210, 225, 245, 200 * clampedAlpha);
  shininess(120);
  box(config.cubeSize * 1.02);
  pop();
}
