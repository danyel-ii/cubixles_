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

export function drawInkEdges() {
  const strokes = [
    { weight: 7.2, alpha: 70, tint: [210, 210, 215] },
    { weight: 5.2, alpha: 140, tint: [230, 230, 235] },
    { weight: 3.4, alpha: 220, tint: [245, 245, 248] },
    { weight: 2.0, alpha: 170, tint: [255, 255, 255] },
  ];
  const time = frameCount * 0.04;
  const driftAmp = 8.5;
  const driftFreq = 2.6;

  strokes.forEach((strokeInfo, pass) => {
    stroke(
      strokeInfo.tint[0],
      strokeInfo.tint[1],
      strokeInfo.tint[2],
      strokeInfo.alpha
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

  stroke(215, 215, 220, 55);
  strokeWeight(9.2);
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
}
