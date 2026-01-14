import { config } from "./app-config.js";
import { state } from "./app-state.js";

export function buildEdges() {
  state.edgePasses = [];
  const half = config.cubeSize / 2 + 6;
  const corners = [
    createVector(-half, -half, -half),
    createVector(half, -half, -half),
    createVector(half, half, -half),
    createVector(-half, half, -half),
    createVector(-half, -half, half),
    createVector(half, -half, half),
    createVector(half, half, half),
    createVector(-half, half, half),
  ];
  const edgePairs = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  noiseSeed(12);
  edgePairs.forEach(([aIndex, bIndex], edgeIndex) => {
    const a = corners[aIndex];
    const b = corners[bIndex];
    const passes = [];
    for (let pass = 0; pass < 3; pass += 1) {
      passes.push(generateEdgePoints(a, b, edgeIndex, pass));
    }
    state.edgePasses.push(passes);
  });
}

function generateEdgePoints(a, b, edgeIndex, pass) {
  const points = [];
  const steps = 14;
  const dir = p5.Vector.sub(b, a).normalize();
  let rand = p5.Vector.random3D();
  if (abs(p5.Vector.dot(dir, rand)) > 0.9) {
    rand = createVector(0.3, 0.7, 0.2);
  }
  const perp = p5.Vector.cross(dir, rand).normalize();
  const perp2 = p5.Vector.cross(dir, perp).normalize();

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const base = p5.Vector.lerp(a, b, t);
    const wobble = (noise(edgeIndex * 1.7, pass * 2.3, t * 3.4) - 0.5) * 16;
    const wobble2 =
      (noise(edgeIndex * 4.1 + 8, pass * 1.9, t * 4.6) - 0.5) * 12;
    const point = base
      .copy()
      .add(perp.copy().mult(wobble))
      .add(perp2.copy().mult(wobble2));
    points.push(point);
  }
  return points;
}

export function drawInkEdges(alpha = 1) {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  if (clampedAlpha <= 0) {
    return;
  }
  const time = frameCount * 0.04;
  const driftAmp = 9.2;
  const driftFreq = 2.2;
  const shimmerBase = 0.72 + 0.28 * sin(time * 0.6);
  const strokes = [
    { weight: 8.2, alpha: 60, tint: [95, 106, 122] },
    { weight: 5.8, alpha: 120, tint: [160, 172, 188] },
    { weight: 4.0, alpha: 190, tint: [220, 233, 248] },
    { weight: 2.4, alpha: 210, tint: [255, 255, 255] },
  ];

  strokeCap(ROUND);
  strokes.forEach((strokeInfo, pass) => {
    const shimmer = shimmerBase + 0.08 * sin(time * 0.9 + pass * 1.7);
    const alphaValue = Math.min(255, strokeInfo.alpha * clampedAlpha * shimmer);
    stroke(
      strokeInfo.tint[0],
      strokeInfo.tint[1],
      strokeInfo.tint[2],
      alphaValue
    );
    strokeWeight(strokeInfo.weight);
    noFill();
    state.edgePasses.forEach((passes) => {
      const points = passes[pass % passes.length];
      beginShape();
      points.forEach((p, i) => {
        const wobble = noise(i * 0.6, pass * 1.7, time) - 0.5;
        const wobble2 = noise(i * 1.1 + 10, pass * 2.3, time * 1.3) - 0.5;
        vertex(
          p.x + wobble * driftAmp,
          p.y + sin(time * driftFreq + i) * 0.8,
          p.z + wobble2 * driftAmp
        );
      });
      endShape();
    });
  });

  stroke(150, 165, 185, 48 * clampedAlpha);
  strokeWeight(8.4);
  noFill();
  state.edgePasses.forEach((passes) => {
    const points = passes[1];
    beginShape();
    points.forEach((p, i) => {
      const wobble = noise(i * 0.8, time * 0.9) - 0.5;
      vertex(p.x + wobble * 10, p.y, p.z - wobble * 6);
    });
    endShape();
  });

  blendMode(ADD);
  const glint = 0.55 + 0.45 * sin(time * 0.8);
  stroke(210, 235, 255, 90 * clampedAlpha * glint);
  strokeWeight(1.7);
  noFill();
  state.edgePasses.forEach((passes) => {
    const points = passes[2];
    beginShape();
    points.forEach((p, i) => {
      const wobble = noise(i * 0.7, time * 1.1) - 0.5;
      vertex(p.x + wobble * 6, p.y, p.z - wobble * 4);
    });
    endShape();
  });
  blendMode(BLEND);
}
