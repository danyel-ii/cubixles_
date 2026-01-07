const TILE_PALETTE = [
  "#EA7B7B",
  "#D25353",
  "#9E3B3B",
  "#FFEAD3",
  "#2D3C59",
  "#94A378",
  "#E5BA41",
  "#D1855C",
  "#061E29",
  "#1D546D",
  "#5F9598",
  "#F3F4F4",
  "#BBE0EF",
  "#161E54",
  "#F16D34",
  "#FF986A",
  "#FFFDE1",
  "#FBE580",
  "#93BD57",
  "#980404",
  "#3F9AAE",
  "#79C9C5",
  "#FFE2AF",
  "#F96E5B",
  "#0F2854",
  "#1C4D8D",
  "#4988C4",
  "#BDE8F5",
  "#5C6F2B",
  "#DE802B",
  "#D8C9A7",
  "#EEEEEE",
  "#4D2B8C",
  "#85409D",
  "#EEA727",
  "#FFEF5F",
  "#000080",
  "#FF0000",
  "#9E2A3A",
  "#3A2525",
  "#F5F2F2",
  "#FEB05D",
  "#5A7ACD",
  "#2B2A2A",
  "#FFD41D",
  "#FFA240",
  "#D73535",
  "#FF4646",
  "#FDB5CE",
  "#132440",
  "#16476A",
  "#3B9797",
  "#F6F0D7",
  "#C5D89D",
  "#9CAB84",
  "#89986D",
  "#EBE1D1",
  "#41644A",
  "#0D4715",
  "#E9762B",
  "#91C6BC",
  "#4B9DA9",
  "#F6F3C2",
  "#E37434",
  "#97A87A",
  "#A8BBA3",
  "#FCF9EA",
  "#FFA239",
  "#EBF4DD",
  "#90AB8B",
  "#5A7863",
  "#3B4953",
  "#213448",
  "#547792",
  "#94B4C1",
  "#EAE0CF",
  "#B8DB80",
  "#F7F6D3",
  "#FFE4EF",
  "#F39EB6",
  "#001F3D",
  "#ED985F",
  "#F7B980",
  "#E6E6E6",
  "#5A9CB5",
  "#FACE68",
  "#FAAC68",
  "#FA6868",
  "#8A8635",
  "#AA2B1D",
  "#CC561E",
  "#F3CF7A",
  "#6AECE1",
  "#26CCC2",
  "#FFF57E",
  "#FFB76C",
  "#005461",
  "#018790",
  "#00B7B5",
  "#F4F4F4",
  "#1B211A",
  "#628141",
  "#8BAE66",
  "#EBD5AB",
  "#BBCB64",
  "#FFE52A",
  "#F79A19",
  "#CF0F0F",
  "#434E78",
  "#607B8F",
  "#F7E396",
  "#E97F4A",
  "#FCF8F8",
  "#FBEFEF",
  "#F9DFDF",
  "#F5AFAF",
  "#360185",
  "#8F0177",
  "#DE1A58",
  "#F4B342",
  "#FEEAC9",
  "#FFCDC9",
  "#FDACAC",
  "#FD7979",
  "#3291B6",
  "#BB8ED0",
  "#E0A8A8",
  "#F1E2E2",
  "#F29AAE",
  "#C47BE4",
  "#7132CA",
  "#301CA0",
  "#9CC6DB",
  "#FCF6D9",
  "#CF4B00",
  "#DDBA7D",
  "#050E3C",
  "#002455",
  "#DC0000",
  "#FF3838",
  "#1B3C53",
  "#234C6A",
  "#456882",
  "#E3E3E3",
  "#6DC3BB",
  "#393D7E",
  "#5459AC",
  "#F2AEBB",
  "#FAF3E1",
  "#F5E7C6",
  "#FF6D1F",
  "#222222",
  "#F6B1CE",
  "#1581BF",
  "#3DB6B1",
  "#CCE5CF",
  "#E2852E",
  "#F5C857",
  "#FFEE91",
  "#ABE0F0",
  "#FF5555",
  "#FF937E",
  "#C1E59F",
  "#A3D78A",
  "#5A0E24",
  "#76153C",
  "#BF124D",
  "#67B2D8",
  "#452829",
  "#57595B",
  "#E8D1C5",
  "#F3E8DF",
  "#F875AA",
  "#FDEDED",
  "#EDFFF0",
  "#AEDEFC",
  "#D7C097",
  "#E7DEAF",
  "#73AF6F",
  "#007E6E",
  "#D34E4E",
  "#F9E7B2",
  "#DDC57A",
  "#CE7E5A",
  "#F1F3E0",
  "#D2DCB6",
  "#A1BC98",
  "#778873",
  "#E67E22",
  "#FFF2C6",
  "#FFF8DE",
  "#AAC4F5",
  "#8CA9FF",
  "#BF1A1A",
  "#FF6C0C",
  "#FFE08F",
  "#060771",
  "#F8F4EC",
  "#FF8FB7",
];

const CUBE_FACE_SIZE = 4;
const FORMATION_DURATION = 900;
const FORMATION_STAGGER = 14;
const FOLLOW_EASE = 0.12;
const CONFETTI_MAX = 90;
const CONFETTI_LIFE = 900;
const CONFETTI_DRAG = 0.92;
const SWARM_SCALE = 0.33;

let tileSwarm = null;
let listenersAttached = false;
const pointer = { x: 0, y: 0, active: false, lastSeen: 0 };

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function applyBias(rgb, bias) {
  const delta = bias * 255;
  return {
    r: clamp(Math.round(rgb.r + delta), 0, 255),
    g: clamp(Math.round(rgb.g + delta), 0, 255),
    b: clamp(Math.round(rgb.b + delta), 0, 255),
  };
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function projectIso(x, y, z, size) {
  return {
    x: (x - z) * size,
    y: (x + z) * size * 0.5 - y * size,
  };
}

function getDefaultAnchor() {
  return { x: width * 0.74, y: height * 0.24 };
}

function buildFaceCoords(face, faceSize) {
  const coords = [];
  if (face === "top") {
    for (let x = 0; x < faceSize; x += 1) {
      for (let z = 0; z < faceSize; z += 1) {
        coords.push({ x, y: 0, z });
      }
    }
  } else if (face === "left") {
    for (let y = 1; y < faceSize; y += 1) {
      for (let z = 0; z < faceSize; z += 1) {
        coords.push({ x: 0, y, z });
      }
    }
  } else {
    for (let y = 1; y < faceSize; y += 1) {
      for (let x = 0; x < faceSize; x += 1) {
        coords.push({ x, y, z: 0 });
      }
    }
  }
  return coords;
}

function buildTiles(tileSize) {
  const rand = seededRandom(61);
  const faces = [
    { name: "left", shade: -0.12 },
    { name: "right", shade: -0.03 },
    { name: "top", shade: 0.12 },
  ];
  const tiles = [];
  let maxDelay = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  faces.forEach((face) => {
    const coords = buildFaceCoords(face.name, CUBE_FACE_SIZE);
    coords.forEach((coord) => {
      const paletteHex = TILE_PALETTE[Math.floor(rand() * TILE_PALETTE.length)];
      const baseRgb = hexToRgb(paletteHex ?? "#F5F2F2");
      const color = applyBias(baseRgb, face.shade);
      const offset = projectIso(coord.x, coord.y, coord.z, tileSize);
      minX = Math.min(minX, offset.x);
      maxX = Math.max(maxX, offset.x);
      minY = Math.min(minY, offset.y);
      maxY = Math.max(maxY, offset.y);
      const delay = Math.round(rand() * 180 + tiles.length * FORMATION_STAGGER);
      maxDelay = Math.max(maxDelay, delay);
      tiles.push({
        offsetX: offset.x,
        offsetY: offset.y,
        size: tileSize * (0.86 + rand() * 0.24),
        color,
        delay,
        spiralAngle: rand() * Math.PI * 2,
        spiralRadius: tileSize * (CUBE_FACE_SIZE * 2.8 + rand() * CUBE_FACE_SIZE * 2.4),
        phase: rand() * Math.PI * 2,
      });
    });
  });

  const centerOffsetX = (minX + maxX) * 0.5;
  const centerOffsetY = (minY + maxY) * 0.5;
  tiles.forEach((tile) => {
    tile.offsetX -= centerOffsetX;
    tile.offsetY -= centerOffsetY;
  });

  return { tiles, maxDelay };
}

function handlePointerMove(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  pointer.lastSeen = typeof millis === "function" ? millis() : performance.now();
}

function handlePointerLeave() {
  pointer.active = false;
}

function attachListeners() {
  if (listenersAttached || typeof window === "undefined") {
    return;
  }
  listenersAttached = true;
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerMove, { passive: true });
  window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
  window.addEventListener("blur", handlePointerLeave);
  document.addEventListener("overlay-opened", () => {
    if (!tileSwarm) {
      return;
    }
    resetTileSwarm();
  });
}

function setLayerVisibility() {
  const canvas = tileSwarm?.layer?.canvas || tileSwarm?.layer?.elt;
  if (!canvas) {
    return;
  }
  canvas.classList.toggle("is-hidden", tileSwarm.hidden);
}

function resetTileSwarm() {
  if (!tileSwarm) {
    return;
  }
  if (tileSwarm.hidden) {
    setLayerVisibility();
    return;
  }
  const baseSize = clamp(Math.min(width, height) * 0.012, 4, 9);
  const tileSize = Math.max(1.6, baseSize * SWARM_SCALE);
  const { tiles, maxDelay } = buildTiles(tileSize);
  const anchor = getDefaultAnchor();
  tileSwarm.tiles = tiles;
  tileSwarm.tileSize = tileSize;
  tileSwarm.confettiSize = baseSize;
  tileSwarm.maxDelay = maxDelay;
  tileSwarm.anchor = { ...anchor };
  tileSwarm.target = { ...anchor };
  tileSwarm.home = { ...anchor };
  tileSwarm.lastAnchor = { ...anchor };
  tileSwarm.confetti = [];
  tileSwarm.tooltipNode = null;
  tileSwarm.startAt = typeof millis === "function" ? millis() : 0;
  tileSwarm.formed = false;
  setLayerVisibility();
}

function resolveTarget(now) {
  const seenRecently = pointer.active && now - pointer.lastSeen < 2400;
  if (seenRecently) {
    return { x: pointer.x, y: pointer.y };
  }
  if (typeof document !== "undefined") {
    if (!tileSwarm?.tooltipNode) {
      tileSwarm.tooltipNode = document.querySelector("[data-tooltip-anchor], .ui-tooltip");
    }
    if (tileSwarm?.tooltipNode) {
      const rect = tileSwarm.tooltipNode.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }
  return tileSwarm?.home ?? getDefaultAnchor();
}

function spawnConfetti(amount, dx, dy) {
  if (!tileSwarm) {
    return;
  }
  const speedBase = Math.min(2.4, Math.max(0.8, Math.hypot(dx, dy) * 0.05));
  const rand = seededRandom(Math.floor(pointer.lastSeen) + tileSwarm.confetti.length + 3);
  const angleBase = Math.atan2(dy, dx) + Math.PI;
  for (let i = 0; i < amount; i += 1) {
    if (tileSwarm.confetti.length >= CONFETTI_MAX) {
      tileSwarm.confetti.shift();
    }
    const angle = angleBase + (rand() - 0.5) * 1.1;
    const speed = speedBase * (0.5 + rand() * 0.8);
    const paletteHex = TILE_PALETTE[Math.floor(rand() * TILE_PALETTE.length)];
    const color = hexToRgb(paletteHex ?? "#F5F2F2");
    const confettiSize = tileSwarm.confettiSize || tileSwarm.tileSize;
    tileSwarm.confetti.push({
      x: tileSwarm.anchor.x + (rand() - 0.5) * tileSwarm.tileSize * 0.6,
      y: tileSwarm.anchor.y + (rand() - 0.5) * tileSwarm.tileSize * 0.6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: confettiSize * (0.35 + rand() * 0.25),
      age: 0,
      color,
    });
  }
}

function updateConfetti(step) {
  if (!tileSwarm?.confetti?.length) {
    return;
  }
  tileSwarm.confetti = tileSwarm.confetti.filter((piece) => {
    piece.x += piece.vx * step;
    piece.y += piece.vy * step;
    piece.vx *= CONFETTI_DRAG;
    piece.vy *= CONFETTI_DRAG;
    piece.age += deltaTime;
    return piece.age < CONFETTI_LIFE;
  });
}

function drawConfetti(layer) {
  if (!tileSwarm?.confetti?.length) {
    return;
  }
  tileSwarm.confetti.forEach((piece) => {
    const alpha = clamp(1 - piece.age / CONFETTI_LIFE, 0, 1) * 180;
    layer.fill(piece.color.r, piece.color.g, piece.color.b, alpha);
    layer.rect(piece.x, piece.y, piece.size, piece.size);
  });
}

export function initTileSwarm() {
  if (tileSwarm) {
    return;
  }
  tileSwarm = {
    tiles: [],
    confetti: [],
    anchor: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
    lastAnchor: { x: 0, y: 0 },
    home: { x: 0, y: 0 },
    tooltipNode: null,
    layer: null,
    confettiSize: 0,
    tileSize: 0,
    maxDelay: 0,
    startAt: 0,
    formed: false,
    hidden: false,
  };
  attachListeners();
  if (typeof document !== "undefined") {
    tileSwarm.hidden = Boolean(window?.localStorage?.getItem("cubixles:chainId"));
  }
  if (typeof document !== "undefined") {
    document.addEventListener("cubixles-chain-change", () => {
      if (!tileSwarm) {
        return;
      }
      tileSwarm.hidden = true;
      setLayerVisibility();
    });
  }
  const layer = createGraphics(windowWidth, windowHeight);
  layer.pixelDensity(1);
  layer.noSmooth();
  const canvas = layer.canvas || layer.elt;
  if (canvas) {
    canvas.classList.add("tile-swarm-layer");
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
  }
  tileSwarm.layer = layer;
  resetTileSwarm();
}

export function resizeTileSwarm() {
  if (!tileSwarm) {
    return;
  }
  if (tileSwarm.layer) {
    tileSwarm.layer.resizeCanvas(windowWidth, windowHeight);
  }
  resetTileSwarm();
}

export function drawTileSwarm() {
  if (!tileSwarm || !tileSwarm.tiles.length || tileSwarm.hidden || !tileSwarm.layer) {
    return;
  }
  const layer = tileSwarm.layer;
  const now = typeof millis === "function" ? millis() : 0;
  const formationDoneAt = tileSwarm.startAt + FORMATION_DURATION + tileSwarm.maxDelay;
  if (!tileSwarm.formed && now >= formationDoneAt) {
    tileSwarm.formed = true;
  }

  const target = tileSwarm.formed ? resolveTarget(now) : tileSwarm.home;
  tileSwarm.target.x = target.x;
  tileSwarm.target.y = target.y;
  tileSwarm.anchor.x += (tileSwarm.target.x - tileSwarm.anchor.x) * FOLLOW_EASE;
  tileSwarm.anchor.y += (tileSwarm.target.y - tileSwarm.anchor.y) * FOLLOW_EASE;

  const dx = tileSwarm.anchor.x - tileSwarm.lastAnchor.x;
  const dy = tileSwarm.anchor.y - tileSwarm.lastAnchor.y;
  const moveDist = Math.hypot(dx, dy);
  if (tileSwarm.formed && moveDist > 0.4) {
    spawnConfetti(Math.min(3, Math.ceil(moveDist * 0.2)), dx, dy);
  }
  tileSwarm.lastAnchor.x = tileSwarm.anchor.x;
  tileSwarm.lastAnchor.y = tileSwarm.anchor.y;

  const step = clamp(deltaTime / 16.67, 0.6, 2.4);
  updateConfetti(step);

  layer.clear();
  layer.push();
  if (typeof layer.resetMatrix === "function") {
    layer.resetMatrix();
  }
  layer.rectMode(CENTER);
  layer.noStroke();

  drawConfetti(layer);

  tileSwarm.tiles.forEach((tile) => {
    const localTime = now - tileSwarm.startAt - tile.delay;
    const progress = clamp(localTime / FORMATION_DURATION, 0, 1);
    const eased = easeOutCubic(progress);
    const swirl = tile.spiralAngle + now * 0.004 + (1 - eased) * 2.4;
    const radius = tile.spiralRadius * (1 - eased);
    const swirlX = Math.cos(swirl) * radius;
    const swirlY = Math.sin(swirl) * radius;
    const offsetX = lerp(swirlX, tile.offsetX, eased);
    const offsetY = lerp(swirlY, tile.offsetY, eased);
    const bob = tileSwarm.formed ? Math.sin(now * 0.004 + tile.phase) * tileSwarm.tileSize * 0.08 : 0;
    const x = tileSwarm.anchor.x + offsetX;
    const y = tileSwarm.anchor.y + offsetY + bob;
    const alpha = tileSwarm.formed ? 225 : 140 + eased * 85;
    layer.fill(tile.color.r, tile.color.g, tile.color.b, alpha);
    layer.rect(x, y, tile.size, tile.size);
  });

  layer.pop();
}
