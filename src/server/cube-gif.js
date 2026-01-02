import { createCanvas } from "@napi-rs/canvas";
import GIFEncoder from "gif-encoder-2";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return null;
  }
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return null;
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function shadeColor(color, factor) {
  const r = clamp(Math.round(color.r * factor), 0, 255);
  const g = clamp(Math.round(color.g * factor), 0, 255);
  const b = clamp(Math.round(color.b * factor), 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function rotateX({ x, y, z }, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x, y: y * cos - z * sin, z: y * sin + z * cos };
}

function rotateY({ x, y, z }, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos + z * sin, y, z: -x * sin + z * cos };
}

function project({ x, y, z }, { size, depth, center }) {
  const scale = size / (z + depth);
  return {
    x: center + x * scale,
    y: center + y * scale,
  };
}

function drawFace(ctx, points, color) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

export async function generateCubeGif({
  colors,
  size = 512,
  frames = 20,
  delayMs = 80,
} = {}) {
  const palette = (Array.isArray(colors) ? colors : [])
    .map((entry) => (typeof entry === "string" ? hexToRgb(entry) : null))
    .filter(Boolean);
  const fallback = [
    { r: 80, g: 160, b: 220 },
    { r: 220, g: 170, b: 90 },
    { r: 170, g: 210, b: 160 },
  ];
  const [frontColor, rightColor, topColor] =
    palette.length >= 3 ? palette.slice(0, 3) : fallback;

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const encoder = new GIFEncoder(size, size);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(delayMs);
  encoder.setQuality(10);

  const center = size / 2;
  const cubeHalf = 0.9;
  const baseSize = size * 0.9;
  const depth = 3.2;

  const vertices = [
    { x: -cubeHalf, y: -cubeHalf, z: -cubeHalf },
    { x: cubeHalf, y: -cubeHalf, z: -cubeHalf },
    { x: cubeHalf, y: cubeHalf, z: -cubeHalf },
    { x: -cubeHalf, y: cubeHalf, z: -cubeHalf },
    { x: -cubeHalf, y: -cubeHalf, z: cubeHalf },
    { x: cubeHalf, y: -cubeHalf, z: cubeHalf },
    { x: cubeHalf, y: cubeHalf, z: cubeHalf },
    { x: -cubeHalf, y: cubeHalf, z: cubeHalf },
  ];

  const faces = [
    { idx: [4, 5, 6, 7], base: frontColor },
    { idx: [1, 5, 6, 2], base: rightColor },
    { idx: [3, 2, 6, 7], base: topColor },
    { idx: [0, 1, 2, 3], base: frontColor },
    { idx: [0, 4, 7, 3], base: rightColor },
    { idx: [0, 1, 5, 4], base: topColor },
  ];

  for (let frame = 0; frame < frames; frame += 1) {
    const t = frame / frames;
    const rotY = t * Math.PI * 2;
    const rotX = -0.4 + Math.sin(t * Math.PI * 2) * 0.15;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgba(8, 10, 14, 0.85)";
    ctx.fillRect(0, 0, size, size);

    const transformed = vertices.map((vertex) => {
      const rot = rotateY(rotateX(vertex, rotX), rotY);
      return {
        ...rot,
        projected: project(rot, { size: baseSize, depth, center }),
      };
    });

    const faceDepths = faces
      .map((face) => {
        const avgZ =
          face.idx.reduce((sum, idx) => sum + transformed[idx].z, 0) /
          face.idx.length;
        return { ...face, avgZ };
      })
      .sort((a, b) => a.avgZ - b.avgZ);

    for (const face of faceDepths) {
      const points = face.idx.map((idx) => transformed[idx].projected);
      const shade = clamp(0.65 + (face.avgZ + 1.2) * 0.25, 0.45, 0.95);
      drawFace(ctx, points, shadeColor(face.base, shade));
    }

    encoder.addFrame(ctx);
  }

  encoder.finish();
  return Buffer.from(encoder.out.getData());
}
