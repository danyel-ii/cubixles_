import { config } from "./app-config.js";
import { state } from "./app-state.js";
import { fillFaceDataUrls } from "./app-utils.js";

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

function buildStandaloneHtml(dataUrls, startRotX, startRotY, startZoom, backgroundDataUrl) {
  const embeddedBackground = backgroundDataUrl
    ? JSON.stringify(backgroundDataUrl)
    : "null";
  const embeddedUrls = JSON.stringify(dataUrls);
  const safeRotX = Number.isFinite(startRotX) ? startRotX.toFixed(4) : "-0.35";
  const safeRotY = Number.isFinite(startRotY) ? startRotY.toFixed(4) : "0.65";
  const safeZoom = Number.isFinite(startZoom) ? startZoom.toFixed(1) : "520";
  const cubeSize = config.cubeSize;
  const minZoom = config.zoom.min;
  const maxZoom = config.zoom.max;

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
    <script>
      const EMBEDDED_URLS = ${embeddedUrls};
      const EMBEDDED_BACKGROUND = ${embeddedBackground};
      let textures = [];
      let faceTextures = [];
      let bgImage = null;
      let cubeSize = ${cubeSize};
      let rotX = ${safeRotX};
      let rotY = ${safeRotY};
      let zoom = ${safeZoom};
      let minZoom = ${minZoom};
      let maxZoom = ${maxZoom};
      let edgePasses = [];
      let lastMouse = null;
      let pinchStartDist = null;
      let pinchStartZoom = null;
      let backdrop;

      function preload() {
        textures = EMBEDDED_URLS.map((url) => loadImage(url));
        if (EMBEDDED_BACKGROUND) {
          bgImage = loadImage(EMBEDDED_BACKGROUND);
        }
      }

      function setup() {
        createCanvas(windowWidth, windowHeight, WEBGL);
        pixelDensity(1);
        textureMode(NORMAL);
        noStroke();
        backdrop = createGraphics(windowWidth, windowHeight);
        updateBackdrop();
        buildWobblyEdges();
        faceTextures = fillFaceTextures(textures);
      }

      function draw() {
        drawBackdrop();
        lights();
        camera(0, 0, zoom, 0, 0, 0, 0, 1, 0);
        rotateX(rotX);
        rotateY(rotY);
        noStroke();
        drawTexturedFaces();
        drawGlassShell();
        drawInkEdges();
        drawForegroundBackdrop();
      }

      function drawBackdrop() {
        if (bgImage) {
          const t = frameCount * 0.0016;
          push();
          resetMatrix();
          camera(0, 0, zoom, 0, 0, 0, 0, 1, 0);
          noStroke();
          texture(bgImage);
          tint(255, 180);
          rotateY(t * 0.7);
          rotateX(-0.2 + sin(t * 0.9) * 0.05);
          scale(-1, 1, 1);
          sphere(1700, 48, 32);
          pop();

          push();
          noStroke();
          texture(bgImage);
          tint(255, 90);
          rotateY(-t * 1.2);
          rotateX(0.25 + sin(t * 1.3) * 0.04);
          scale(-1, 1, 1);
          sphere(1250, 36, 24);
          pop();

          push();
          noStroke();
          texture(bgImage);
          tint(255, 65);
          rotateY(t * 1.4);
          rotateX(0.4 + sin(t * 0.6) * 0.08);
          translate(0, 0, -900);
          plane(width * 3, height * 3);
          pop();

          push();
          noStroke();
          texture(bgImage);
          tint(255, 80);
          rotateY(t * 1.1);
          rotateX(0.15);
          translate(0, 0, 620);
          rotateY(t * 0.4);
          plane(width * 2.4, height * 2.4);
          pop();
          return;
        }

        push();
        noStroke();
        texture(backdrop);
        translate(0, 0, -900);
        plane(width * 2, height * 2);
        pop();
      }

      function drawForegroundBackdrop() {
        if (!bgImage) {
          return;
        }
        const t = frameCount * 0.0016;
        push();
        resetMatrix();
        camera(0, 0, zoom, 0, 0, 0, 0, 1, 0);
        noStroke();
        texture(bgImage);
        tint(255, 95);
        rotateY(t * 1.4);
        rotateX(0.12 + sin(t * 1.1) * 0.05);
        translate(0, 0, 320);
        rotateY(-t * 0.6);
        plane(width * 2.0, height * 2.0);
        pop();
      }

      function updateBackdrop() {
        backdrop.clear();
        const ctx = backdrop.drawingContext;
        const gradient = ctx.createLinearGradient(0, 0, backdrop.width, backdrop.height);
        gradient.addColorStop(0, "#0b1015");
        gradient.addColorStop(0.5, "#131923");
        gradient.addColorStop(1, "#0c0f14");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, backdrop.width, backdrop.height);
      }

      function lights() {
        ambientLight(90, 95, 110);
        pointLight(255, 255, 255, 200, -200, 300);
        directionalLight(200, 210, 220, -0.4, 0.5, -1);
      }

      function drawTexturedFaces() {
        const half = cubeSize / 2 - 1;
        const face = cubeSize * 0.98;
        const tintAlpha = 245;
        drawFace(faceTextures[0], 0, 0, half, 0, 0, 0, false, face, tintAlpha);
        drawFace(faceTextures[1], 0, 0, -half, 0, PI, 0, true, face, tintAlpha);
        drawFace(faceTextures[2], half, 0, 0, 0, HALF_PI, 0, false, face, tintAlpha);
        drawFace(faceTextures[3], -half, 0, 0, 0, -HALF_PI, 0, true, face, tintAlpha);
        drawFace(faceTextures[4], 0, -half, 0, -HALF_PI, 0, 0, false, face, tintAlpha);
        drawFace(faceTextures[5], 0, half, 0, HALF_PI, 0, 0, true, face, tintAlpha);
      }

      function drawFace(img, x, y, z, rx, ry, rz, mirrorX, size, alpha) {
        if (!img) {
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

      function drawGlassShell() {
        push();
        specularMaterial(210, 225, 245, 200);
        shininess(120);
        box(cubeSize * 1.02);
        pop();
      }

      function fillFaceTextures(sourceTextures) {
        const filled = [];
        for (let i = 0; i < 6; i += 1) {
          filled.push(sourceTextures[i % sourceTextures.length]);
        }
        return filled;
      }

      function buildWobblyEdges() {
        edgePasses = [];
        const half = cubeSize / 2 + 6;
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
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7],
        ];
        noiseSeed(12);
        edgePairs.forEach(([aIndex, bIndex], edgeIndex) => {
          const a = corners[aIndex];
          const b = corners[bIndex];
          const passes = [];
          for (let pass = 0; pass < 3; pass += 1) {
            passes.push(generateEdgePoints(a, b, edgeIndex, pass));
          }
          edgePasses.push(passes);
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
          const wobble2 = (noise(edgeIndex * 4.1 + 8, pass * 1.9, t * 4.6) - 0.5) * 12;
          const point = base.copy()
            .add(perp.copy().mult(wobble))
            .add(perp2.copy().mult(wobble2));
          points.push(point);
        }
        return points;
      }

      function drawInkEdges() {
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
          const alphaValue = Math.min(255, strokeInfo.alpha * shimmer);
          stroke(strokeInfo.tint[0], strokeInfo.tint[1], strokeInfo.tint[2], alphaValue);
          strokeWeight(strokeInfo.weight);
          noFill();
          edgePasses.forEach((passes) => {
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
        stroke(150, 165, 185, 48);
        strokeWeight(8.4);
        noFill();
        edgePasses.forEach((passes) => {
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
        stroke(210, 235, 255, 90 * glint);
        strokeWeight(1.7);
        noFill();
        edgePasses.forEach((passes) => {
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

      function mousePressed() {
        lastMouse = { x: mouseX, y: mouseY };
      }

      function mouseDragged() {
        if (!lastMouse) {
          return;
        }
        const dx = mouseX - lastMouse.x;
        const dy = mouseY - lastMouse.y;
        updateRotation(dx, dy);
        lastMouse = { x: mouseX, y: mouseY };
      }

      function mouseReleased() {
        lastMouse = null;
      }

      function mouseWheel(event) {
        zoom = constrain(zoom + event.delta * 0.4, minZoom, maxZoom);
        return false;
      }

      function touchStarted() {
        if (touches.length === 2) {
          pinchStartDist = dist(
            touches[0].x,
            touches[0].y,
            touches[1].x,
            touches[1].y
          );
          pinchStartZoom = zoom;
        } else if (touches.length === 1) {
          lastMouse = { x: touches[0].x, y: touches[0].y };
        }
        return false;
      }

      function touchMoved() {
        if (touches.length === 2) {
          const currentDist = dist(
            touches[0].x,
            touches[0].y,
            touches[1].x,
            touches[1].y
          );
          if (pinchStartDist !== null) {
            const delta = currentDist - pinchStartDist;
            zoom = constrain(pinchStartZoom - delta * 1.2, minZoom, maxZoom);
          }
        } else if (touches.length === 1 && lastMouse) {
          const dx = touches[0].x - lastMouse.x;
          const dy = touches[0].y - lastMouse.y;
          updateRotation(dx, dy);
          lastMouse = { x: touches[0].x, y: touches[0].y };
        }
        return false;
      }

      function touchEnded() {
        if (touches.length < 2) {
          pinchStartDist = null;
          pinchStartZoom = null;
        }
        if (touches.length === 0) {
          lastMouse = null;
        }
        return false;
      }

      function updateRotation(dx, dy) {
        rotY += dx * 0.005;
        rotX += dy * 0.005;
        rotX = constrain(rotX, -PI / 2 + 0.05, PI / 2 - 0.05);
      }

      function windowResized() {
        resizeCanvas(windowWidth, windowHeight);
        backdrop = createGraphics(windowWidth, windowHeight);
        updateBackdrop();
      }
    </script>
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
