import fs from "fs/promises";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import QRCode from "qrcode";

const DEFAULT_QR_SIZE = 512;
const DEFAULT_CARD_SIZE = 1024;
const DEFAULT_QR_RATIO = 0.22;
const DEFAULT_QR_MARGIN_RATIO = 0.06;
const DEFAULT_BASE_IMAGE = path.join(
  process.cwd(),
  "public",
  "assets",
  "builder-card-base.png"
);

async function loadBaseImage() {
  const configured = process.env.BUILDER_BASE_IMAGE_PATH;
  const candidates = [configured, DEFAULT_BASE_IMAGE].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const buffer = await fs.readFile(candidate);
      const image = await loadImage(buffer);
      return { image, width: image.width, height: image.height };
    } catch (error) {
      void error;
    }
  }
  return null;
}

function drawPlaceholder(ctx, width, height) {
  ctx.fillStyle = "#f7f2e8";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(27, 23, 19, 0.08)";
  for (let x = 48; x < width; x += 72) {
    ctx.fillRect(x, 0, 1, height);
  }
  for (let y = 48; y < height; y += 72) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.fillStyle = "#1b1713";
  ctx.font = "bold 42px sans-serif";
  ctx.fillText("cubixles_ builder", 56, 86);
  ctx.font = "24px sans-serif";
  ctx.fillStyle = "rgba(27, 23, 19, 0.7)";
  ctx.fillText("placeholder card", 56, 126);
}

export async function generateQrBuffer(viewerUrl, size = DEFAULT_QR_SIZE) {
  if (!viewerUrl) {
    throw new Error("Viewer URL missing.");
  }
  return QRCode.toBuffer(viewerUrl, {
    width: size,
    margin: 1,
    color: {
      dark: "#1b1713",
      light: "#ffffff",
    },
  });
}

export async function renderBuilderCard({ qrBuffer }) {
  const baseImage = await loadBaseImage();
  const width = baseImage?.width || DEFAULT_CARD_SIZE;
  const height = baseImage?.height || DEFAULT_CARD_SIZE;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (baseImage?.image) {
    ctx.drawImage(baseImage.image, 0, 0, width, height);
  } else {
    drawPlaceholder(ctx, width, height);
  }

  const qrImage = await loadImage(qrBuffer);
  const minSide = Math.min(width, height);
  const qrSize = Math.round(minSide * DEFAULT_QR_RATIO);
  const margin = Math.round(minSide * DEFAULT_QR_MARGIN_RATIO);
  const qrX = Math.max(margin, width - qrSize - margin);
  const qrY = Math.max(margin, height - qrSize - margin);

  ctx.fillStyle = "rgba(247, 242, 232, 0.95)";
  ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
  ctx.strokeStyle = "rgba(27, 23, 19, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  return canvas.toBuffer("image/png");
}
