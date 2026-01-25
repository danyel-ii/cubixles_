"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";

const BILLBOARDS = [
  {
    id: "skeptic",
    title: "Skeptic Checklist",
    tag: "verify",
    body: "Verify no custody, legible pricing, routed value. Then ship your thesis cube.",
  },
  {
    id: "builder",
    title: "Builder Garage",
    tag: "build",
    body: "Mint a one-face cube first. Keep originals, publish context.",
  },
  {
    id: "router",
    title: "Value Router",
    tag: "route",
    body: "Audit split flows. Route value to the works you referenced.",
  },
  {
    id: "summit",
    title: "Far Ridge",
    tag: "map",
    body: "Reach the ridge to unlock the map overlay.",
  },
  {
    id: "relay",
    title: "Signal Relay",
    tag: "signal",
    body: "Configuration becomes the market object. Rarity = executed geometry.",
  },
];

function makeBillboardTexture(label, tag) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff7ee";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  for (let i = 0; i < 16; i += 1) {
    const p = i * 32;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(210,83,83,0.18)";
  ctx.fillRect(32, 32, 160, 44);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, 160, 44);
  ctx.fillStyle = "#000";
  ctx.font = "700 18px 'Space Mono', monospace";
  ctx.fillText((tag || "PFP").toUpperCase(), 48, 60);

  ctx.fillStyle = "#000";
  ctx.font = "800 38px 'Space Grotesk', sans-serif";
  wrapText(ctx, label, 48, 180, 420, 46);

  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, 464, 464);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  words.forEach((word, idx) => {
    const testLine = `${line}${word} `;
    if (ctx.measureText(testLine).width > maxWidth && idx > 0) {
      ctx.fillText(line.trim(), x, yy);
      line = `${word} `;
      yy += lineHeight;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line.trim(), x, yy);
}

export default function WorldScene() {
  const mountRef = useRef(null);
  const hintRef = useRef(null);
  const statusRef = useRef(null);
  const mapRef = useRef(null);
  const mapCanvasRef = useRef(null);
  const controlsRef = useRef(null);
  const panelTitleRef = useRef(null);
  const panelBodyRef = useRef(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [qualityHigh, setQualityHigh] = useState(true);
  const [helpVisible, setHelpVisible] = useState(true);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapLocked, setMapLocked] = useState(true);

  const stateRef = useRef({
    muted: true,
    qualityHigh: true,
    helpVisible: true,
    mapVisible: false,
    mapLocked: true,
  });

  const actionsRef = useRef({
    toggleAudio: () => {},
    toggleQuality: () => {},
    toggleHelp: () => {},
    toggleMap: () => {},
    respawn: () => {},
    closePanel: () => {},
  });

  useEffect(() => {
    stateRef.current = { muted, qualityHigh, helpVisible, mapVisible, mapLocked };
  }, [muted, qualityHigh, helpVisible, mapVisible, mapLocked]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return () => {};

    let animationFrame;
    let resizeObserver;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c101f);
    scene.fog = new THREE.FogExp2(0x1c101f, 0.009);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.classList.add("world-canvas");
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      500
    );
    camera.position.set(0, 12, 18);

    const ambient = new THREE.AmbientLight(0xf6e9e6, 0.55);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xfff5ea, 0x241321, 1.25);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.45);
    dir.position.set(10, 22, 12);
    scene.add(dir);
    const accent = new THREE.PointLight(0xd25353, 1.6, 46, 2);
    accent.position.set(-8, 10, -6);
    scene.add(accent);
    const fill = new THREE.PointLight(0xfff2e8, 0.8, 60, 2);
    fill.position.set(10, 6, -18);
    scene.add(fill);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(220, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x2a1430, side: THREE.BackSide })
    );
    scene.add(sky);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(6, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff5ec })
    );
    sun.position.set(60, 44, -80);
    scene.add(sun);
    const sunLight = new THREE.PointLight(0xfff2ea, 1.6, 160, 2);
    sunLight.position.copy(sun.position);
    scene.add(sunLight);

    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 16;
    skyCanvas.height = 256;
    const skyCtx = skyCanvas.getContext("2d");
    const gradient = skyCtx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#2b1332");
    gradient.addColorStop(0.45, "#46243f");
    gradient.addColorStop(1, "#7a3b58");
    skyCtx.fillStyle = gradient;
    skyCtx.fillRect(0, 0, 16, 256);
    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    const skyPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 180),
      new THREE.MeshBasicMaterial({ map: skyTexture, transparent: true, opacity: 0.9 })
    );
    skyPlane.position.set(0, 55, -120);
    scene.add(skyPlane);

    const backdropCanvas = document.createElement("canvas");
    backdropCanvas.width = 8;
    backdropCanvas.height = 128;
    const bctx = backdropCanvas.getContext("2d");
    const bgrad = bctx.createLinearGradient(0, 0, 0, 128);
    bgrad.addColorStop(0, "#7a3b58");
    bgrad.addColorStop(1, "#2a1430");
    bctx.fillStyle = bgrad;
    bctx.fillRect(0, 0, 8, 128);
    const backdropTex = new THREE.CanvasTexture(backdropCanvas);
    const backdropMat = new THREE.MeshBasicMaterial({
      map: backdropTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const backdropGroup = new THREE.Group();
    scene.add(backdropGroup);
    for (let i = 0; i < 6; i += 1) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(140, 50), backdropMat);
      const angle = (i / 6) * Math.PI * 2;
      plane.position.set(Math.cos(angle) * 90, 20, Math.sin(angle) * 90);
      plane.rotation.y = -angle + Math.PI / 2;
      backdropGroup.add(plane);
    }

    const starsGeo = new THREE.BufferGeometry();
    const starCount = 400;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const radius = 120 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starsGeo,
      new THREE.PointsMaterial({
        color: 0xf5e1f0,
        size: 0.8,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
      })
    );
    scene.add(stars);

    const grid = new THREE.GridHelper(180, 36, 0x3d2a3a, 0x2a1b28);
    grid.position.y = 0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    scene.add(grid);

    const groundGeo = new THREE.PlaneGeometry(400, 400, 1, 1);
    const groundCanvas = document.createElement("canvas");
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const gctx = groundCanvas.getContext("2d");
    gctx.fillStyle = "#2a1b28";
    gctx.fillRect(0, 0, 512, 512);
    gctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    for (let i = 0; i <= 16; i += 1) {
      const p = i * 32;
      gctx.beginPath();
      gctx.moveTo(p, 0);
      gctx.lineTo(p, 512);
      gctx.stroke();
      gctx.beginPath();
      gctx.moveTo(0, p);
      gctx.lineTo(512, p);
      gctx.stroke();
    }
    gctx.strokeStyle = "rgba(210, 83, 83, 0.15)";
    gctx.lineWidth = 2;
    gctx.strokeRect(40, 40, 432, 432);
    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(8, 8);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: groundTex,
      roughness: 0.95,
      metalness: 0.05,
      emissive: new THREE.Color(0x1a0f1a),
      emissiveIntensity: 0.15,
    });
    let cpnTexture = null;
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/assets/CPN.png",
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        groundMat.map = tex;
        groundMat.needsUpdate = true;
        cpnTexture = tex;
      },
      undefined,
      () => {}
    );
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const ringGroup = new THREE.Group();
    scene.add(ringGroup);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x6a3c55,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    [18, 34, 50, 66].forEach((radius) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.2, radius + 0.2, 96),
        ringMat
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      ringGroup.add(ring);
    });

    const terrainGroup = new THREE.Group();
    scene.add(terrainGroup);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x332234,
      roughness: 0.9,
      metalness: 0.05,
    });
    const terrainSeeds = [
      { x: -48, z: -24, s: 18 },
      { x: 52, z: 10, s: 22 },
      { x: -30, z: 44, s: 16 },
      { x: 18, z: 58, s: 14 },
      { x: 40, z: -52, s: 20 },
    ];
    terrainSeeds.forEach(({ x, z, s }) => {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 24), terrainMat);
      hill.position.set(x, -s * 0.6, z);
      hill.scale.set(1, 0.35, 1);
      terrainGroup.add(hill);
    });

    const roadCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-60, 0.1, 30),
      new THREE.Vector3(-30, 0.1, 12),
      new THREE.Vector3(-4, 0.1, -10),
      new THREE.Vector3(20, 0.1, -24),
      new THREE.Vector3(42, 0.1, -6),
      new THREE.Vector3(58, 0.1, 26),
    ]);
    const roadGeo = new THREE.TubeGeometry(roadCurve, 80, 2.4, 12, false);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x2b1a28,
      roughness: 0.95,
      metalness: 0.05,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    scene.add(road);

    const roadGlow = new THREE.Mesh(
      new THREE.TubeGeometry(roadCurve, 80, 0.35, 8, false),
      new THREE.MeshStandardMaterial({
        color: 0xd25353,
        emissive: new THREE.Color(0xd25353),
        emissiveIntensity: 0.6,
        roughness: 0.4,
        metalness: 0.1,
      })
    );
    scene.add(roadGlow);

    const towerGroup = new THREE.Group();
    scene.add(towerGroup);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x3c2a3c,
      roughness: 0.75,
      metalness: 0.1,
    });
    const towerPositions = [
      [-32, 24],
      [36, -18],
      [54, 36],
      [-58, -36],
    ];
    towerPositions.forEach(([x, z]) => {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 10, 16), towerMat);
      tower.position.set(x, 5, z);
      towerGroup.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3, 16), towerMat);
      cap.position.set(x, 11, z);
      towerGroup.add(cap);
    });

    const archGroup = new THREE.Group();
    scene.add(archGroup);
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x433042,
      roughness: 0.8,
      metalness: 0.05,
    });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(6, 0.4, 16, 80), archMat);
    arch.rotation.x = Math.PI / 2;
    arch.position.set(0, 3, -34);
    archGroup.add(arch);

    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    world.allowSleep = true;
    world.broadphase = new CANNON.SAPBroadphase(world);

    const matGround = new CANNON.Material("ground");
    const matCube = new CANNON.Material("cube");
    world.addContactMaterial(
      new CANNON.ContactMaterial(matGround, matCube, {
        friction: 0.25,
        restitution: 0.05,
      })
    );

    const groundBody = new CANNON.Body({ mass: 0, material: matGround });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const cubeSize = 1.35;
    const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xfff0ea,
      roughness: 0.12,
      metalness: 0.0,
      transmission: 0.86,
      thickness: 0.8,
      ior: 1.45,
      transparent: true,
      opacity: 1.0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
      emissive: new THREE.Color(0x3d1731),
      emissiveIntensity: 0.45,
    });
    const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
    cubeMesh.position.set(0, 1.2, 0);
    scene.add(cubeMesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(cubeGeo, 22),
      new THREE.LineBasicMaterial({ color: 0xd25353, transparent: true, opacity: 0.7 })
    );
    cubeMesh.add(edges);

    const cubeBody = new CANNON.Body({
      mass: 3.0,
      material: matCube,
      position: new CANNON.Vec3(0, 1.2, 0),
      linearDamping: 0.12,
      angularDamping: 0.9,
    });
    cubeBody.addShape(
      new CANNON.Box(new CANNON.Vec3(cubeSize / 2, cubeSize / 2, cubeSize / 2))
    );
    cubeBody.allowSleep = false;
    world.addBody(cubeBody);

    const obstacles = new THREE.Group();
    scene.add(obstacles);
    const addBox = (x, z, w, h, d, color = 0x2a1f2a) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 })
      );
      mesh.position.set(x, h / 2, z);
      obstacles.add(mesh);
      const body = new CANNON.Body({ mass: 0, material: matGround });
      body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
      body.position.set(x, h / 2, z);
      world.addBody(body);
    };
    const addRamp = (x, z, w, h, d, angle) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: 0x251a25, roughness: 0.85 })
      );
      mesh.position.set(x, h / 2, z);
      mesh.rotation.x = -angle;
      obstacles.add(mesh);
      const body = new CANNON.Body({ mass: 0, material: matGround });
      body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
      body.position.set(x, h / 2, z);
      body.quaternion.setFromEuler(-angle, 0, 0);
      world.addBody(body);
    };

    addBox(0, -8, 3.4, 0.9, 1.1);
    addBox(8, 0, 1.1, 0.9, 3.4);
    addBox(-8, 0, 1.1, 0.9, 3.4);
    addRamp(-10, 16, 3.8, 0.6, 7.2, 0.2);
    addRamp(12, 22, 3.8, 0.6, 7.2, 0.24);

    const propGroup = new THREE.Group();
    scene.add(propGroup);
    const propMat = new THREE.MeshStandardMaterial({
      color: 0x4b3448,
      roughness: 0.82,
      metalness: 0.08,
    });
    const crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const postGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.6, 10);
    const propPositions = [
      [-6, -18],
      [12, -22],
      [18, 12],
      [-18, 14],
      [30, -8],
      [-26, 26],
      [22, 34],
      [10, 46],
      [-36, -12],
      [42, 10],
    ];
    propPositions.forEach(([x, z], idx) => {
      const crate = new THREE.Mesh(crateGeo, propMat);
      crate.position.set(x, 0.7, z);
      crate.rotation.y = idx * 0.3;
      propGroup.add(crate);
      const post = new THREE.Mesh(postGeo, propMat);
      post.position.set(x + 2, 1.3, z + 1);
      propGroup.add(post);
    });

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xfff1eb,
      roughness: 0.2,
      metalness: 0.2,
      emissive: new THREE.Color(0xd25353),
      emissiveIntensity: 0.5,
    });
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.9, 6, 12);
    [
      [-20, -30],
      [24, -32],
      [34, 20],
      [-34, 28],
      [6, 42],
    ].forEach(([x, z]) => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 3, z);
      propGroup.add(pillar);
    });

    const billboardGroup = new THREE.Group();
    scene.add(billboardGroup);
    const billboardState = [];
    const floaters = [];
    const beacons = [];
    const flags = [];

    const rings = [
      { radius: 18, ids: ["builder", "relay", "skeptic", "router"] },
      { radius: 34, ids: ["summit", "relay", "builder", "skeptic"] },
      { radius: 54, ids: ["router", "summit", "builder", "relay", "skeptic", "router"] },
    ];
    const spawnRing = (ring) => {
      const count = ring.ids.length;
      for (let i = 0; i < count; i += 1) {
        const id = ring.ids[i];
        const def = BILLBOARDS.find((entry) => entry.id === id) || BILLBOARDS[i % BILLBOARDS.length];
        const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.2 - 0.1);
        const radius = ring.radius + (Math.random() * 2 - 1);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const texture = makeBillboardTexture(def.title, def.tag);
        const mat = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.9,
          metalness: 0.05,
          transparent: true,
          opacity: 0.96,
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), mat);
        plane.position.set(x, 2.8, z);
        plane.rotation.y = -angle + Math.PI;
        plane.userData = { def };
        billboardGroup.add(plane);

        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.11, 2.4, 12),
          new THREE.MeshStandardMaterial({ color: 0x241a25, roughness: 0.95 })
        );
        post.position.set(x, 1.2, z);
        billboardGroup.add(post);

        billboardState.push({ mesh: plane, def, interactRadius: 3.2 });
      }
    };

    rings.forEach(spawnRing);

    const floaterGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const floaterMat = new THREE.MeshStandardMaterial({
      color: 0xd25353,
      roughness: 0.2,
      metalness: 0.2,
      emissive: new THREE.Color(0x5c2036),
      emissiveIntensity: 0.4,
    });
    for (let i = 0; i < 18; i += 1) {
      const floater = new THREE.Mesh(floaterGeo, floaterMat);
      const angle = (i / 18) * Math.PI * 2;
      const radius = 22 + (i % 3) * 6;
      floater.position.set(Math.cos(angle) * radius, 4 + (i % 4), Math.sin(angle) * radius);
      scene.add(floater);
      floaters.push({ mesh: floater, baseY: floater.position.y, speed: 0.6 + (i % 5) * 0.15 });
    }

    const beaconGeo = new THREE.CylinderGeometry(0.35, 0.6, 4, 12);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xfff0f2,
      roughness: 0.3,
      metalness: 0.1,
      emissive: new THREE.Color(0xd25353),
      emissiveIntensity: 0.35,
    });
    [
      { x: -24, z: 14 },
      { x: 26, z: -28 },
      { x: 50, z: 32 },
      { x: -46, z: -26 },
    ].forEach((pos, idx) => {
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(pos.x, 2, pos.z);
      scene.add(beacon);
      const glow = new THREE.PointLight(0xd25353, 0.8, 18, 2);
      glow.position.set(pos.x, 3.5, pos.z);
      scene.add(glow);
      beacons.push({ mesh: beacon, light: glow, phase: idx * 0.8 });
    });

    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xfff1eb,
      emissive: new THREE.Color(0xd25353),
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    [
      { x: -12, z: 6 },
      { x: 14, z: -6 },
      { x: 22, z: 12 },
      { x: -24, z: -14 },
      { x: 30, z: 2 },
      { x: -30, z: 18 },
    ].forEach((pos, idx) => {
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), flagMat);
      flag.position.set(pos.x, 3 + (idx % 2), pos.z);
      flag.rotation.y = (idx * Math.PI) / 3;
      scene.add(flag);
      flags.push({ mesh: flag, baseY: flag.position.y, phase: idx * 0.7 });
    });

    const mapCanvas = mapCanvasRef.current;
    const mapCtx = mapCanvas ? mapCanvas.getContext("2d") : null;

    const keys = new Set();
    let heading = 0;
    let speed = 0;
    let wantsInteract = false;
    let last = performance.now();
    let nearest = null;
    let audioCtx = null;
    let osc = null;
    let gain = null;

    const panelOpenRef = { current: false };

    const onKeyDown = (event) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      keys.add(event.code);
      if (event.code === "Enter") wantsInteract = true;
      if (event.code === "KeyM") toggleMap();
      if (event.code === "KeyR") respawn();
      if (event.code === "KeyL") toggleAudio();
      if (event.code === "KeyH") toggleHelp();
    };

    const onKeyUp = (event) => {
      keys.delete(event.code);
      if (event.code === "Enter") wantsInteract = false;
      if (event.code === "Escape") closePanel();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const updateHint = (text, visible) => {
      const hintEl = hintRef.current;
      if (!hintEl) return;
      if (visible) {
        hintEl.textContent = text;
        hintEl.classList.add("is-visible");
      } else {
        hintEl.classList.remove("is-visible");
      }
    };

    const updateStatus = (text) => {
      if (statusRef.current) {
        statusRef.current.textContent = text;
      }
    };

    const openPanel = (def) => {
      if (!panelTitleRef.current || !panelBodyRef.current) return;
      panelTitleRef.current.textContent = def.title;
      panelBodyRef.current.textContent = def.body;
      panelOpenRef.current = true;
      setPanelOpen(true);
    };

    const closePanel = () => {
      panelOpenRef.current = false;
      setPanelOpen(false);
    };

    actionsRef.current.closePanel = closePanel;

    const toggleHelp = () => {
      setHelpVisible((prev) => !prev);
    };

    const toggleMap = () => {
      if (stateRef.current.mapLocked) {
        updateStatus("Map locked · reach Far Ridge");
        return;
      }
      setMapVisible((prev) => !prev);
    };

    const respawn = () => {
      cubeBody.position.set(0, 1.2, 0);
      cubeBody.velocity.set(0, 0, 0);
      cubeBody.angularVelocity.set(0, 0, 0);
      heading = 0;
      speed = 0;
    };

    const toggleAudio = () => {
      setMuted((prev) => {
        const next = !prev;
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          osc = audioCtx.createOscillator();
          gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.value = 50;
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
        }
        if (!next) {
          audioCtx.resume?.();
          gain.gain.setTargetAtTime(0.02, audioCtx.currentTime, 0.06);
        } else {
          gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.06);
        }
        return next;
      });
    };

    const toggleQuality = () => {
      setQualityHigh((prev) => {
        const next = !prev;
        const pixelRatio = next ? Math.min(window.devicePixelRatio, 2) : 1;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        stars.visible = next;
        floaters.forEach((floater) => {
          floater.mesh.visible = next;
        });
        return next;
      });
    };

    actionsRef.current.toggleAudio = toggleAudio;
    actionsRef.current.toggleQuality = toggleQuality;
    actionsRef.current.toggleHelp = toggleHelp;
    actionsRef.current.toggleMap = toggleMap;
    actionsRef.current.respawn = respawn;

    const updateMap = () => {
      if (!mapCtx || !mapCanvas) return;
      if (!stateRef.current.mapVisible) return;
      const w = mapCanvas.width;
      const h = mapCanvas.height;
      mapCtx.clearRect(0, 0, w, h);
      mapCtx.fillStyle = "rgba(255,247,238,0.95)";
      mapCtx.fillRect(0, 0, w, h);
      mapCtx.strokeStyle = "rgba(0,0,0,0.6)";
      mapCtx.lineWidth = 2;
      mapCtx.strokeRect(8, 8, w - 16, h - 16);

      const scale = (w - 20) / 140;
      billboardState.forEach((billboard) => {
        const x = (billboard.mesh.position.x + 70) * scale + 10;
        const y = (billboard.mesh.position.z + 70) * scale + 10;
        mapCtx.fillStyle = "rgba(210,83,83,0.8)";
        mapCtx.fillRect(x - 2, y - 2, 4, 4);
      });
      const px = (cubeBody.position.x + 70) * scale + 10;
      const py = (cubeBody.position.z + 70) * scale + 10;
      mapCtx.fillStyle = "#000";
      mapCtx.beginPath();
      mapCtx.arc(px, py, 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    };

    const updateBillboards = () => {
      nearest = null;
      let best = Infinity;
      billboardState.forEach((item) => {
        const dx = cubeBody.position.x - item.mesh.position.x;
        const dz = cubeBody.position.z - item.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        const mat = item.mesh.material;
        if (dist < 6) {
          mat.emissive = new THREE.Color(0xd25353);
          mat.emissiveIntensity = 0.35;
        } else {
          mat.emissiveIntensity = 0;
        }
        if (dist < item.interactRadius && dist < best) {
          best = dist;
          nearest = item;
        }
      });

      if (nearest) {
        updateHint(`Press ENTER to inspect ${nearest.def.title}`, true);
      } else {
        updateHint("", false);
      }

      if (nearest && wantsInteract && !panelOpenRef.current) {
        wantsInteract = false;
        openPanel(nearest.def);
        if (nearest.def.id === "summit" && stateRef.current.mapLocked) {
          setMapLocked(false);
          setMapVisible(true);
          updateStatus("Map unlocked · press M to toggle");
        }
      }
    };

    const animate = () => {
      if (disposed) return;
      animationFrame = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;

      if (!panelOpenRef.current) {
        const left = keys.has("KeyA") || keys.has("ArrowLeft");
        const right = keys.has("KeyD") || keys.has("ArrowRight");
        const forward = keys.has("KeyW") || keys.has("ArrowUp");
        const back = keys.has("KeyS") || keys.has("ArrowDown");
        const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const jump = keys.has("Space");

        const turnRate = boost ? 2.4 : 1.8;
        if (left) heading += turnRate * dt;
        if (right) heading -= turnRate * dt;

        const accel = boost ? 20 : 12;
        const maxSpeed = boost ? 22 : 14;
        const decel = 9;
        if (forward) speed += accel * dt;
        else if (back) speed -= accel * dt;
        else speed -= Math.sign(speed) * decel * dt;
        speed = THREE.MathUtils.clamp(speed, -maxSpeed * 0.6, maxSpeed);

        const fx = Math.sin(heading);
        const fz = Math.cos(heading);
        cubeBody.velocity.x = fx * speed;
        cubeBody.velocity.z = fz * speed;
        cubeBody.quaternion.setFromEuler(0, heading, 0);

        const onGround =
          Math.abs(cubeBody.position.y - 1.2) < 0.3 || Math.abs(cubeBody.velocity.y) < 0.05;
        if (jump && onGround) {
          cubeBody.velocity.y = 6.2;
        }

        if (audioCtx && osc && gain && !stateRef.current.muted) {
          const targetHz = 45 + Math.min(120, Math.abs(speed) * 6);
          osc.frequency.setTargetAtTime(targetHz, audioCtx.currentTime, 0.06);
          const targetGain = 0.012 + Math.min(0.02, Math.abs(speed) * 0.0015);
          gain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.08);
        }
      }

      world.step(1 / 60, dt, 3);
      cubeMesh.position.copy(cubeBody.position);
      cubeMesh.quaternion.copy(cubeBody.quaternion);

      const camTarget = cubeMesh.position.clone();
      const camOffset = new THREE.Vector3(
        Math.sin(heading + Math.PI) * 12,
        8,
        Math.cos(heading + Math.PI) * 12
      );
      camera.position.copy(camTarget).add(camOffset);
      camera.lookAt(camTarget);

      billboardState.forEach((item) => {
        item.mesh.lookAt(camera.position.x, item.mesh.position.y, camera.position.z);
      });

      floaters.forEach((floater, idx) => {
        const t = now * 0.001 * floater.speed + idx;
        floater.mesh.rotation.y = t * 0.8;
        floater.mesh.rotation.x = t * 0.35;
        floater.mesh.position.y = floater.baseY + Math.sin(t) * 0.6;
      });

      beacons.forEach((beacon) => {
        const pulse = 0.5 + Math.sin(now * 0.002 + beacon.phase) * 0.25;
        beacon.light.intensity = 0.6 + pulse;
        beacon.mesh.scale.setScalar(1 + pulse * 0.05);
      });

      flags.forEach((flag) => {
        const t = now * 0.001 + flag.phase;
        flag.mesh.position.y = flag.baseY + Math.sin(t) * 0.3;
        flag.mesh.rotation.z = Math.sin(t) * 0.2;
      });

      updateBillboards();
      updateMap();

      renderer.render(scene, camera);
    };

    resizeObserver = new ResizeObserver(() => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    updateStatus("Drive the cubixle · reach the ridge · press ENTER");
    animate();

    return () => {
      disposed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (resizeObserver) resizeObserver.disconnect();
      cancelAnimationFrame(animationFrame);
      if (osc) {
        try {
          osc.stop();
        } catch {
          // ignore
        }
      }
      if (audioCtx) {
        audioCtx.close?.();
      }
      if (cpnTexture) {
        cpnTexture.dispose();
      }
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="world-root">
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div className="world-hud">
        <div className="world-topbar">
          <div className="world-card">
            <h1>cubixles_ world</h1>
            <p>Drive the cubixle through a neon magenta landscape. Inspect markers to learn the next step.</p>
          </div>
          <div className="world-pillrow">
            <button
              className={`world-pill ${!muted ? "is-on" : ""}`}
              type="button"
              onClick={() => actionsRef.current.toggleAudio()}
            >
              <span className="dot"></span>
              <span>Audio</span>
              <span className="state">{muted ? "Muted" : "On"}</span>
            </button>
            <button
              className={`world-pill ${qualityHigh ? "is-on" : ""}`}
              type="button"
              onClick={() => actionsRef.current.toggleQuality()}
            >
              <span className="dot"></span>
              <span>Quality</span>
              <span className="state">{qualityHigh ? "High" : "Low"}</span>
            </button>
            <button className="world-pill" type="button" onClick={() => actionsRef.current.toggleHelp()}>
              <span className="dot"></span>
              <span>Help</span>
            </button>
            <button className="world-pill" type="button" onClick={() => actionsRef.current.toggleMap()}>
              <span className="dot"></span>
              <span>Map</span>
              <span className="state">{mapLocked ? "Locked" : mapVisible ? "On" : "Off"}</span>
            </button>
            <button className="world-pill" type="button" onClick={() => actionsRef.current.respawn()}>
              <span className="dot"></span>
              <span>Respawn</span>
            </button>
          </div>
        </div>
        <div
          className="world-controls"
          style={{ display: helpVisible ? "block" : "none" }}
          ref={controlsRef}
        >
          <div className="row">
            <span className="world-kbd">WASD</span>
            move
            <span className="world-kbd">ARROWS</span>
            move
            <span className="world-kbd">SHIFT</span>
            boost
            <span className="world-kbd">SPACE</span>
            hop
            <span className="world-kbd">ENTER</span>
            inspect
            <span className="world-kbd">M</span>
            map
            <span className="world-kbd">R</span>
            respawn
            <span className="world-kbd">L</span>
            audio
          </div>
          <div style={{ marginTop: 8, color: "rgba(0,0,0,0.6)" }}>
            Hint: reach the far ridge to unlock the map.
          </div>
        </div>
        <div className="world-hint" ref={hintRef}></div>
        <div className="world-status" ref={statusRef}></div>
        <div className={`world-map ${mapVisible ? "is-visible" : ""}`} ref={mapRef}>
          <canvas ref={mapCanvasRef} width={180} height={180}></canvas>
        </div>
        <div className={`world-panel ${panelOpen ? "is-open" : ""}`}>
          <div className="world-panel-card">
            <div className="world-panel-head">
              <h2 ref={panelTitleRef}>Marker</h2>
              <button
                className="world-panel-close"
                type="button"
                onClick={() => actionsRef.current.closePanel()}
              >
                Close
              </button>
            </div>
            <div className="world-panel-body" ref={panelBodyRef}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
