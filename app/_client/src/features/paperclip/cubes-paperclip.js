import {
  buildPaperclipLayers,
  createPaperclipRng,
  PAPERCLIP_SCALE,
} from "../../shared/paperclip-model.js";

const BACKDROP = "#0b1220";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function buildLayerMask(size, params, prng) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.fillStyle = params.color;
  ctx.fillRect(0, 0, size, size);

  const grid = params.grid;
  const cell = size / grid;
  const holeProb = params.holeProb;
  const baseRadius = params.radius;
  const squareMix = params.squareMix;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      if (prng() > holeProb) {
        continue;
      }
      const jitterX = (prng() - 0.5) * cell * 0.45;
      const jitterY = (prng() - 0.5) * cell * 0.45;
      const centerX = (x + 0.5) * cell + jitterX;
      const centerY = (y + 0.5) * cell + jitterY;
      const radius = baseRadius * cell * (0.65 + prng() * 0.6);
      const sizeBox = radius * 2;
      if (prng() < squareMix) {
        drawRoundedRect(
          ctx,
          centerX - radius,
          centerY - radius,
          sizeBox,
          sizeBox,
          radius * (0.2 + prng() * 0.6)
        );
      } else {
        ctx.moveTo(centerX + radius, centerY);
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      }
    }
  }
  ctx.fill();
  ctx.restore();

  return canvas;
}

function resolveSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width || canvas.width || 640);
  const height = Math.max(1, rect.height || canvas.height || 640);
  return { width, height };
}

function getPaperclipLayout(width, height) {
  const size = Math.min(width, height) * PAPERCLIP_SCALE;
  return {
    size,
    centerX: width / 2,
    centerY: height / 2,
  };
}

function drawPaperclipLayers(ctx, layout, layers) {
  const { size, centerX, centerY } = layout;

  for (const layer of layers) {
    const prng = createPaperclipRng(layer.layerSeed);
    const params = {
      color: layer.color,
      grid: layer.grid,
      holeProb: layer.holeProbability,
      radius: layer.radiusFactor,
      squareMix: layer.squareMix,
      rotation: layer.rotation,
      scale: layer.scale,
      offsetX: layer.offsetX,
      offsetY: layer.offsetY,
      shadow: layer.shadowBlur,
    };

    const layerCanvas = buildLayerMask(Math.round(size), params, prng);

    ctx.save();
    ctx.translate(centerX + params.offsetX, centerY + params.offsetY);
    ctx.rotate(params.rotation);
    ctx.scale(params.scale, params.scale);
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = params.shadow;
    ctx.shadowOffsetY = layer.shadowOffsetY;
    ctx.drawImage(layerCanvas, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

export function renderCubesPaperClip({ canvas, seed, palette, overlay }) {
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { width, height } = resolveSize(canvas);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const layout = getPaperclipLayout(width, height);
  const { layers } = buildPaperclipLayers({ seed, palette });

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, width, height);
  drawPaperclipLayers(ctx, layout, layers);

  if (overlay) {
    const overlaySize = layout.size * 0.65;
    const overlayX = layout.centerX + layout.size / 2 - overlaySize;
    const overlayY = layout.centerY + layout.size / 2 - overlaySize;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(overlay, overlayX, overlayY, overlaySize, overlaySize);
    ctx.restore();
  }
}
