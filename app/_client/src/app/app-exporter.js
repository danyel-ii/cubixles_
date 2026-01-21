import { config } from "./app-config.js";
import { state } from "./app-state.js";
import { fillFaceDataUrls } from "./app-utils.js";
import { getTokenViewBaseUrl } from "../config/links.js";

export function handleExport() {
  if (state.selectedDataUrls.length === 0) {
    alert("Select up to 6 local images before exporting.");
    return;
  }
  const filledUrls = fillFaceDataUrls(state.selectedDataUrls);
  const exportWithBackground = () => {
    const html = buildStandaloneHtml(
      filledUrls,
      state.rotX,
      state.rotY,
      state.zoom,
      state.bgImageDataUrl
    );
    downloadText("glass-cube.html", html);
  };

  if (state.bgImageDataUrl) {
    exportWithBackground();
    return;
  }

  fetchBackgroundDataUrl().then(exportWithBackground);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function resolveExportBaseUrl() {
  const base = getTokenViewBaseUrl();
  if (base) {
    return base;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function buildStandaloneHtml(dataUrls, startRotX, startRotY, startZoom, backgroundDataUrl) {
  const safeRotX = Number.isFinite(startRotX) ? startRotX.toFixed(4) : "-0.35";
  const safeRotY = Number.isFinite(startRotY) ? startRotY.toFixed(4) : "0.65";
  const safeZoom = Number.isFinite(startZoom) ? startZoom.toFixed(1) : "520";
  const cubeSize = config.cubeSize;
  const minZoom = config.zoom.min;
  const maxZoom = config.zoom.max;
  const exportPayload = {
    urls: dataUrls,
    background: backgroundDataUrl || null,
    rotX: Number(safeRotX),
    rotY: Number(safeRotY),
    zoom: Number(safeZoom),
    cubeSize,
    minZoom,
    maxZoom,
  };
  const encodedExportPayload = encodeURIComponent(JSON.stringify(exportPayload));
  const exportBaseUrl = resolveExportBaseUrl();
  const exportScriptUrl = exportBaseUrl
    ? `${exportBaseUrl}/assets/cubixles-export.js`
    : "/assets/cubixles-export.js";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>cubixles_</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #0d0f13; overflow: hidden; }
      canvas { display: block; touch-action: none; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/p5@1.9.2/lib/p5.min.js"></script>
  </head>
  <body>
    <script src="${exportScriptUrl}" data-export="${encodedExportPayload}"></script>
  </body>
</html>`;
}

export function fetchBackgroundDataUrl() {
  return fetch(config.backgroundUrl)
    .then((response) => (response.ok ? response.blob() : null))
    .then((blob) => {
      if (!blob) {
        return null;
      }
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    })
    .then((dataUrl) => {
      state.bgImageDataUrl = dataUrl;
      return dataUrl;
    })
    .catch(() => null);
}
