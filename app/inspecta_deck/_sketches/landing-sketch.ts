import type { FaceDefinition } from "../_data/landing-provenance";
import { FACE_REGISTRY } from "../_data/landing-provenance";
import { PALETTE_COLORS } from "../_data/paletteColors";

type SketchOptions = {
  onFaceChange: (faceId: FaceDefinition["id"]) => void;
  onRotationChange?: (rotationX: number, rotationY: number) => void;
  parent?: HTMLElement;
};

type Point3D = {
  x: number;
  y: number;
  z: number;
};

const BASE_VERTICES: Point3D[] = [
  { x: -1, y: -1, z: -1 },
  { x: 1, y: -1, z: -1 },
  { x: 1, y: 1, z: -1 },
  { x: -1, y: 1, z: -1 },
  { x: -1, y: -1, z: 1 },
  { x: 1, y: -1, z: 1 },
  { x: 1, y: 1, z: 1 },
  { x: -1, y: 1, z: 1 },
];

const FACE_STRUCTURES: {
  id: FaceDefinition["id"];
  indices: number[];
}[] = [
  { id: "+Z", indices: [4, 5, 6, 7] },
  { id: "-Z", indices: [0, 1, 2, 3] },
  { id: "+X", indices: [1, 5, 6, 2] },
  { id: "-X", indices: [0, 4, 7, 3] },
  { id: "+Y", indices: [3, 2, 6, 7] },
  { id: "-Y", indices: [0, 1, 5, 4] },
];

const FACE_NORMALS: Record<FaceDefinition["id"], [number, number, number]> = {
  "+X": [1, 0, 0],
  "-X": [-1, 0, 0],
  "+Y": [0, 1, 0],
  "-Y": [0, -1, 0],
  "+Z": [0, 0, 1],
  "-Z": [0, 0, -1],
};

const COLLAGE_ANCHORS = [
  { x: 0.2, y: 0.22, size: 8 },
  { x: 0.72, y: 0.18, size: 6 },
  { x: 0.17, y: 0.72, size: 5 },
  { x: 0.58, y: 0.68, size: 7 },
  { x: 0.38, y: 0.38, size: 4 },
];

const DRIFT_SPEED = 0.0012;
const DRIFT_DELAY_MS = 600;
const SCALE_RATIO = 0.32;
const TILE_GRID = 7;
const TILE_STROKE = [20, 22, 28, 90] as const;

export function createLandingSketch(p5: any, options: SketchOptions) {
  let rotationX = 0;
  let rotationY = 0;
  let targetX = 0;
  let targetY = 0;
  let dragging = false;
  let lastPointer = { x: 0, y: 0 };
  let lastInteraction = -DRIFT_DELAY_MS;
  let lastFaceId: FaceDefinition["id"] | null = null;
  let lastEmit = 0;
  const faceMap = FACE_REGISTRY.reduce<Record<FaceDefinition["id"], FaceDefinition>>(
    (acc, face) => {
      acc[face.id] = face;
      return acc;
    },
    {} as Record<FaceDefinition["id"], FaceDefinition>
  );

  function getParentWidth() {
    if (options.parent) {
      return options.parent.clientWidth || 360;
    }
    if (typeof window !== "undefined") {
      return window.innerWidth;
    }
    return 360;
  }

  const resizeCanvas = () => {
    const targetWidth = Math.max(320, Math.min(getParentWidth(), 760));
    const targetHeight = Math.max(320, targetWidth * 0.7);
    p5.resizeCanvas(targetWidth, targetHeight);
  };

  const updateRotation = () => {
    rotationX += (targetX - rotationX) * 0.08;
    rotationY += (targetY - rotationY) * 0.08;
    if (!dragging && p5.millis() - lastInteraction > DRIFT_DELAY_MS) {
      targetY += DRIFT_SPEED;
      targetX += DRIFT_SPEED * 0.6;
    }
  };

  const rotateVector = (vector: [number, number, number], rx: number, ry: number) => {
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const x = vector[0];
    const y = vector[1];
    const z = vector[2];
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    const x2 = x * cosY + z1 * sinY;
    const z2 = -x * sinY + z1 * cosY;
    return { x: x2, y: y1, z: z2 };
  };

  const detectFrontFace = (rx: number, ry: number): FaceDefinition["id"] => {
    let bestFace: FaceDefinition["id"] = FACE_REGISTRY[0].id;
    let bestZ = -Infinity;
    FACE_STRUCTURES.forEach((face) => {
      const rotated = rotateVector(FACE_NORMALS[face.id], rx, ry);
      if (rotated.z > bestZ) {
        bestZ = rotated.z;
        bestFace = face.id;
      }
    });
    return bestFace;
  };

  const maybeReportFace = (faceId: FaceDefinition["id"]) => {
    const now = p5.millis();
    if (now - lastEmit < 110) {
      return;
    }
    lastEmit = now;
    if (faceId !== lastFaceId) {
      lastFaceId = faceId;
      options.onFaceChange(faceId);
    }
  };

  const rotatePoint = (point: Point3D, scale: number, rx: number, ry: number) => {
    const scaled = {
      x: point.x * scale,
      y: point.y * scale,
      z: point.z * scale,
    };
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const y1 = scaled.y * cosX - scaled.z * sinX;
    const z1 = scaled.y * sinX + scaled.z * cosX;
    const x2 = scaled.x * cosY + z1 * sinY;
    const z2 = -scaled.x * sinY + z1 * cosY;
    return { x: x2, y: y1, z: z2 };
  };

  const projectPoint = (point: Point3D, centerX: number, centerY: number) => {
    const depth = 720 / (720 - point.z);
    return {
      x: centerX + point.x * depth,
      y: centerY + point.y * depth,
      z: point.z,
    };
  };

  const drawBackground = (centerX: number, centerY: number, scale: number) => {
    p5.push();
    p5.noFill();
    p5.strokeWeight(1);
    p5.stroke(255, 20);
    p5.rectMode(p5.CENTER);
    for (let i = -1; i <= 1; i += 1) {
      const offset = i * 12;
      p5.rect(centerX + offset, centerY + offset, scale * 2.6, scale * 2.6);
    }
    p5.pop();

    p5.push();
    p5.noStroke();
    p5.fill(255, 16);
    COLLAGE_ANCHORS.forEach((anchor) => {
      p5.rectMode(p5.CENTER);
      p5.rect(
        centerX + (anchor.x - 0.5) * scale * 2.1,
        centerY + (anchor.y - 0.5) * scale * 2.1,
        anchor.size,
        anchor.size
      );
    });
    p5.pop();
  };

  const drawFace = (
    polygon: { x: number; y: number; z: number }[],
    faceId: FaceDefinition["id"],
    centroid: { x: number; y: number },
    frontFace: FaceDefinition["id"]
  ) => {
    const faceDef = faceMap[faceId];
    if (!faceDef) {
      return;
    }
    const isActive = faceId === frontFace;
    const alpha = isActive ? 225 : 200;
    const [p0, p1, p2, p3] = polygon;
    const edgeAlpha = isActive ? 140 : 90;

    const tileColorIndex = (tileIndex: number) => {
      const base =
        faceId.charCodeAt(0) * 31 +
        faceId.charCodeAt(1) * 17 +
        tileIndex * 131;
      return PALETTE_COLORS[base % PALETTE_COLORS.length] ?? "#f5f2f2";
    };

    const pointOnQuad = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number },
      d: { x: number; y: number },
      u: number,
      v: number
    ) => {
      const ab = { x: p5.lerp(a.x, b.x, u), y: p5.lerp(a.y, b.y, u) };
      const dc = { x: p5.lerp(d.x, c.x, u), y: p5.lerp(d.y, c.y, u) };
      return { x: p5.lerp(ab.x, dc.x, v), y: p5.lerp(ab.y, dc.y, v) };
    };

    p5.stroke(...TILE_STROKE);
    p5.strokeWeight(0.7);

    for (let row = 0; row < TILE_GRID; row += 1) {
      for (let col = 0; col < TILE_GRID; col += 1) {
        const u0 = col / TILE_GRID;
        const v0 = row / TILE_GRID;
        const u1 = (col + 1) / TILE_GRID;
        const v1 = (row + 1) / TILE_GRID;
        const tileIndex = row * TILE_GRID + col;

        const c0 = pointOnQuad(p0, p1, p2, p3, u0, v0);
        const c1 = pointOnQuad(p0, p1, p2, p3, u1, v0);
        const c2 = pointOnQuad(p0, p1, p2, p3, u1, v1);
        const c3 = pointOnQuad(p0, p1, p2, p3, u0, v1);

        const color = p5.color(tileColorIndex(tileIndex));
        color.setAlpha(alpha);
        p5.fill(color);
        p5.beginShape();
        p5.vertex(c0.x, c0.y);
        p5.vertex(c1.x, c1.y);
        p5.vertex(c2.x, c2.y);
        p5.vertex(c3.x, c3.y);
        p5.endShape(p5.CLOSE);
      }
    }

    p5.stroke(faceDef.palette.border);
    p5.strokeWeight(1.6);
    p5.noFill();
    p5.beginShape();
    polygon.forEach((vertex) => {
      p5.vertex(vertex.x, vertex.y);
    });
    p5.endShape(p5.CLOSE);

    const accentColor = p5.color(faceDef.palette.accent);
    accentColor.setAlpha(edgeAlpha);
    p5.stroke(accentColor);
    p5.strokeWeight(1.3);
    p5.beginShape();
    polygon.slice(0, 3).forEach((vertex) => {
      p5.vertex(vertex.x, vertex.y);
    });
    p5.endShape();

    p5.push();
    p5.noStroke();
    const accentFill = p5.color(faceDef.palette.accent);
    accentFill.setAlpha(edgeAlpha);
    p5.fill(accentFill);
    p5.rectMode(p5.CENTER);
    p5.rect(centroid.x, centroid.y - 7, 22, 3);
    p5.rect(centroid.x - 12, centroid.y + 5, 6, 6);
    p5.rect(centroid.x + 10, centroid.y + 6, 4, 4);
    p5.pop();
  };

  p5.setup = () => {
    const initialWidth = Math.max(320, Math.min(getParentWidth(), 760));
    const initialHeight = Math.max(320, initialWidth * 0.7);
    const canvas = p5.createCanvas(initialWidth, initialHeight);
    canvas.parent(options.parent ?? document.body);
    canvas.style("display", "block");
    p5.pixelDensity(1);
    p5.textFont("Space Grotesk, IBM Plex Sans, system-ui");
    p5.noSmooth();
  };

  p5.windowResized = () => {
    resizeCanvas();
  };

  p5.mousePressed = () => {
    dragging = true;
    lastPointer = { x: p5.mouseX, y: p5.mouseY };
    lastInteraction = p5.millis();
  };

  const handleDrag = () => {
    if (!dragging) {
      return false;
    }
    const dx = p5.mouseX - lastPointer.x;
    const dy = p5.mouseY - lastPointer.y;
    targetY += dx * 0.008;
    targetX += dy * 0.008;
    lastPointer = { x: p5.mouseX, y: p5.mouseY };
    lastInteraction = p5.millis();
    return false;
  };

  p5.mouseDragged = () => handleDrag();

  p5.mouseReleased = () => {
    dragging = false;
  };

  p5.touchStarted = p5.mousePressed;
  p5.touchMoved = () => {
    handleDrag();
    return true;
  };
  p5.touchEnded = p5.mouseReleased;

  p5.draw = () => {
    p5.clear();
    const centerX = p5.width / 2;
    const centerY = p5.height / 2;
    const scale = Math.min(p5.width, p5.height) * SCALE_RATIO;

    drawBackground(centerX, centerY, scale);
    updateRotation();
    if (options.onRotationChange) {
      options.onRotationChange(rotationX, rotationY);
    }

    const rotated = BASE_VERTICES.map((vertex) => rotatePoint(vertex, scale, rotationX, rotationY));
    const projected = rotated.map((vertex) => projectPoint(vertex, centerX, centerY));
    const frontFace = detectFrontFace(rotationX, rotationY);

    const faceEntries = FACE_STRUCTURES.map((face) => {
      const polygon = face.indices.map((index) => projected[index]);
      const depth = polygon.reduce((sum, pnt) => sum + pnt.z, 0) / polygon.length;
      const centroid = {
        x: polygon.reduce((sum, pnt) => sum + pnt.x, 0) / polygon.length,
        y: polygon.reduce((sum, pnt) => sum + pnt.y, 0) / polygon.length,
      };
      return { faceId: face.id, polygon, depth, centroid };
    });

    faceEntries
      .sort((a, b) => a.depth - b.depth)
      .forEach((entry) => drawFace(entry.polygon, entry.faceId, entry.centroid, frontFace));

    maybeReportFace(frontFace);
  };
}
