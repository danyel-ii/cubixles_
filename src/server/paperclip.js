import fs from "fs/promises";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import QRCode from "qrcode";
import {
  buildPaperclipLayers,
  createPaperclipRng,
  DEFAULT_PAPERCLIP_SIZE,
  PAPERCLIP_SCALE,
  normalizePaperclipPalette,
} from "../shared/paperclip-model.js";

const BACKDROP = "#0b1220";
const QR_BACKDROP = "#f7f2e8";
const QR_QUIET = 4;
const DEFAULT_OVERLAY_PATH = path.join(process.cwd(), "public", "assets", "cube.png");
let overlayPromise = null;

export { DEFAULT_PAPERCLIP_SIZE, normalizePaperclipPalette };

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
  const canvas = createCanvas(size, size);
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

function getPaperclipLayout(width, height) {
  const sizePx = Math.min(width, height) * PAPERCLIP_SCALE;
  return {
    sizePx,
    centerX: width / 2,
    centerY: height / 2,
  };
}

function drawPaperclipLayers(ctx, layout, layers) {
  const { sizePx, centerX, centerY } = layout;
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

    const layerCanvas = buildLayerMask(Math.round(sizePx), params, prng);

    ctx.save();
    ctx.translate(centerX + params.offsetX, centerY + params.offsetY);
    ctx.rotate(params.rotation);
    ctx.scale(params.scale, params.scale);
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = params.shadow;
    ctx.shadowOffsetY = layer.shadowOffsetY;
    ctx.drawImage(layerCanvas, -sizePx / 2, -sizePx / 2, sizePx, sizePx);
    ctx.restore();
  }
}

function buildQrModules(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    return null;
  }
  try {
    const qr = QRCode.create(trimmed, { errorCorrectionLevel: "H" });
    return qr?.modules || null;
  } catch (error) {
    void error;
    return null;
  }
}

function applyQrClip(ctx, modules, width, height) {
  const count = modules?.size;
  if (!count) {
    return false;
  }
  const grid = count + QR_QUIET * 2;
  const moduleSize = Math.floor(Math.min(width, height) / grid);
  if (moduleSize < 1) {
    return false;
  }
  const qrSize = moduleSize * grid;
  const offsetX = Math.round((width - qrSize) / 2);
  const offsetY = Math.round((height - qrSize) / 2);

  ctx.beginPath();
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      if (!modules.get(x, y)) {
        continue;
      }
      const rectX = offsetX + (x + QR_QUIET) * moduleSize;
      const rectY = offsetY + (y + QR_QUIET) * moduleSize;
      ctx.rect(rectX, rectY, moduleSize, moduleSize);
    }
  }
  ctx.clip();
  return true;
}

async function loadOverlayImage() {
  if (overlayPromise) {
    return overlayPromise;
  }
  overlayPromise = (async () => {
    try {
      const buffer = await fs.readFile(DEFAULT_OVERLAY_PATH);
      return await loadImage(buffer);
    } catch (error) {
      void error;
      return null;
    }
  })();
  return overlayPromise;
}

async function drawPaperclipOverlay(ctx, layout) {
  const overlayImage = await loadOverlayImage();
  if (!overlayImage) {
    return;
  }
  const overlaySize = layout.sizePx * 0.65;
  const overlayX = layout.centerX + layout.sizePx / 2 - overlaySize;
  const overlayY = layout.centerY + layout.sizePx / 2 - overlaySize;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.drawImage(overlayImage, overlayX, overlayY, overlaySize, overlaySize);
  ctx.restore();
}

export async function renderPaperclipBuffer({
  seed,
  palette,
  size = DEFAULT_PAPERCLIP_SIZE,
} = {}) {
  const canvasSize = Math.max(1, Number(size) || DEFAULT_PAPERCLIP_SIZE);
  const canvas = createCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Paperclip canvas unavailable.");
  }

  const layout = getPaperclipLayout(canvasSize, canvasSize);
  const { layers } = buildPaperclipLayers({ seed, palette });

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  drawPaperclipLayers(ctx, layout, layers);
  await drawPaperclipOverlay(ctx, layout);

  return canvas.toBuffer("image/png");
}

export async function renderPaperclipQrBuffer({
  seed,
  palette,
  size = DEFAULT_PAPERCLIP_SIZE,
  qrText,
} = {}) {
  const canvasSize = Math.max(1, Number(size) || DEFAULT_PAPERCLIP_SIZE);
  const canvas = createCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Paperclip QR canvas unavailable.");
  }

  const layout = getPaperclipLayout(canvasSize, canvasSize);
  const { layers } = buildPaperclipLayers({ seed, palette });
  const qrModules = buildQrModules(qrText);

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  if (!qrModules) {
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    drawPaperclipLayers(ctx, layout, layers);
    await drawPaperclipOverlay(ctx, layout);
    return canvas.toBuffer("image/png");
  }

  ctx.fillStyle = QR_BACKDROP;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.save();
  const clipped = applyQrClip(ctx, qrModules, canvasSize, canvasSize);
  if (clipped) {
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    drawPaperclipLayers(ctx, layout, layers);
    await drawPaperclipOverlay(ctx, layout);
  }
  ctx.restore();

  return canvas.toBuffer("image/png");
}
