export function applyLights() {
  ambientLight(90, 95, 110);
  pointLight(255, 255, 255, 200, -200, 300);
  directionalLight(200, 210, 220, -0.4, 0.5, -1);
}
