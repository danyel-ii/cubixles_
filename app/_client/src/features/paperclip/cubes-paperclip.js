const FALLBACK_PALETTE = ["#D40000", "#FFCC00", "#111111"];
const BACKDROP = "#0b1220";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : null;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
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

export function renderCubesPaperClip({ canvas, seed, palette }) {
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

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, width, height);

  const paletteList = (palette || []).map(normalizeHex).filter(Boolean);
  const colors = paletteList.length ? paletteList : FALLBACK_PALETTE;
  const layerCount = Math.max(1, colors.length);
  const baseSeed = hashString(seed || "cubixles");
  const baseRng = mulberry32(baseSeed);

  const size = Math.min(width, height) * 0.78;
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < layerCount; i += 1) {
    const depth = layerCount <= 1 ? 0 : i / (layerCount - 1);
    const layerSeed = Math.floor(baseRng() * 1e9) + i * 97;
    const prng = mulberry32(layerSeed);
    const params = {
      color: colors[i % colors.length],
      grid: Math.floor(8 + prng() * 12),
      holeProb: 0.55 + prng() * 0.35,
      radius: 0.32 + prng() * 0.32,
      squareMix: prng() * 0.65,
      rotation: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      shadow: 12 + depth * 12,
    };

    const layerCanvas = buildLayerMask(Math.round(size), params, prng);

    ctx.save();
    ctx.translate(centerX + params.offsetX, centerY + params.offsetY);
    ctx.rotate(params.rotation);
    ctx.scale(params.scale, params.scale);
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = params.shadow;
    ctx.shadowOffsetY = 6 + depth * 6;
    ctx.drawImage(layerCanvas, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}
