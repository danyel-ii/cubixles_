import { config } from "./app-config.js";
import { state } from "./app-state.js";

export function drawTexturedFaces() {
  const half = config.cubeSize / 2 - 1;
  const face = config.cubeSize * 0.98;
  const tintAlpha = 210;
  const faces = state.faceTextures;
  drawFace(faces[0], 0, 0, half, 0, 0, 0, false, face, tintAlpha);
  drawFace(faces[1], 0, 0, -half, 0, PI, 0, true, face, tintAlpha);
  drawFace(faces[2], half, 0, 0, 0, HALF_PI, 0, false, face, tintAlpha);
  drawFace(faces[3], -half, 0, 0, 0, -HALF_PI, 0, true, face, tintAlpha);
  drawFace(faces[4], 0, -half, 0, -HALF_PI, 0, 0, false, face, tintAlpha);
  drawFace(faces[5], 0, half, 0, HALF_PI, 0, 0, true, face, tintAlpha);
}

function drawFace(img, x, y, z, rx, ry, rz, mirrorX, size, alpha) {
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

export function drawGlassShell() {
  push();
  specularMaterial(210, 225, 245, 50);
  shininess(120);
  box(config.cubeSize * 1.02);
  pop();
}
