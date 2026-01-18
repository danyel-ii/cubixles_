"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import CubixlesLogo from "../_components/CubixlesLogo.jsx";
import CubixlesText from "../_components/CubixlesText.jsx";
import { CUBIXLES_LOGO_GLYPH } from "../_lib/logo.js";
import { buildBuilderTokenViewUrl } from "../_client/src/config/links.js";
import { buildGatewayUrls } from "../_client/src/shared/uri-policy.js";

const DEFAULT_CHAIN_ID = 1;
const DEFAULT_PAGE_SIZE = 8;
const DEFAULT_MAX_PAGES = 25;
const NOTES_COLUMNS = 25;
const NOTES_ROWS = 32;
const NOTES_SEED = 13579;
const LOGO_SEED = 24680;

const NOTES_COLORS = [
  "#F6F0F0",
  "#F3D0D7",
  "#C4B0FF",
  "#66BFBF",
  "#FF2626",
  "#FBE2E5",
  "#F0D78C",
  "#520556",
  "#0B5269",
  "#E2E0A5",
  "#2DEA8F",
  "#FFF2EF",
  "#8D0B41",
  "#C9D7DD",
  "#62CDFF",
  "#FFFBE7",
  "#C449C2",
  "#ABF0E9",
  "#8ADFDC",
  "#EF7B7B",
  "#DCEDC1",
  "#84D270",
  "#61D2DC",
  "#E1E9C9",
  "#E78F81",
  "#FFC5C5",
  "#205295",
  "#323232",
  "#BD2000",
  "#ECDFC8",
  "#A43737",
  "#FFDD5C",
  "#5DA0A2",
  "#904CA7",
  "#3A316E",
  "#5A827E",
  "#6C946F",
  "#FFC7EA",
  "#FFF7E9",
  "#6166B3",
  "#153E90",
  "#EF4339",
  "#5E227F",
  "#4A2C2C",
  "#FAF3DF",
  "#A6DC8C",
  "#F2FC9F",
  "#BF3131",
  "#E1ACAC",
  "#F4D3D3",
  "#EF5B0C",
  "#865439",
  "#DBCBBD",
  "#94B4C1",
  "#7886C7",
  "#D9EDBF",
  "#FFD3A3",
  "#839AA8",
  "#50CB93",
  "#EEBB4D",
  "#A0855B",
  "#F7F9FF",
  "#DCEDC2",
  "#B3C87A",
  "#FFF98C",
  "#80A1BA",
];

const FLOATING_TILES = [
  {
    href: "https://nodefoundation.com/",
    label: "Open Node Foundation",
    colors: [
      "#f6c933",
      "#f3f1e7",
      "#d4362a",
      "#1a5fd6",
      "#f6c933",
      "#1b9c53",
      "#f28c28",
      "#f6c933",
      "#1a5fd6",
    ],
  },
  {
    href: "https://less.ripe.wtf/",
    label: "Open less.ripe.wtf",
    colors: [
      "#1b9c53",
      "#f3f1e7",
      "#1a5fd6",
      "#f28c28",
      "#1b9c53",
      "#d4362a",
      "#f6c933",
      "#1b9c53",
      "#f28c28",
    ],
  },
  {
    href: "https://studybook.eth.link",
    label: "Open Studybook",
    colors: [
      "#1a5fd6",
      "#f6c933",
      "#f3f1e7",
      "#d4362a",
      "#1a5fd6",
      "#f28c28",
      "#1b9c53",
      "#1a5fd6",
      "#d4362a",
    ],
  },
];

const DEFAULT_PALETTE = {
  id: "EA7B7BD253539E3B3BFFEAD3",
  colors: ["#EA7B7B", "#D25353", "#9E3B3B", "#FFEAD3"],
};

const TOKEN_LIST_COPY =
  "Quick inspection list pulled from the collection API. Use pagination or pull the full set.";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function buildNotesTiles() {
  const tiles = [];
  const prng = mulberry32(NOTES_SEED);
  const sizeMax = 94;
  const sizeMin = 66;
  for (let row = 0; row < NOTES_ROWS; row += 1) {
    const rowFactor = NOTES_ROWS > 1 ? row / (NOTES_ROWS - 1) : 0;
    const baseSize = sizeMax - (sizeMax - sizeMin) * rowFactor;
    for (let col = 0; col < NOTES_COLUMNS; col += 1) {
      const jitterX = (prng() - 0.5) * 2.4;
      const jitterY = (prng() - 0.5) * 2.4;
      const left = clamp(((col + 0.5) / NOTES_COLUMNS) * 100 + jitterX, 0, 100);
      const top = clamp(((row + 0.5) / NOTES_ROWS) * 100 + jitterY, 0, 100);
      const size = baseSize + (prng() - 0.5) * 3;
      const delay = 350 + prng() * 2000;
      const clusterX = (prng() - 0.5) * 130;
      const clusterY = (prng() - 0.5) * 130;
      const rotation = -13 + prng() * 0.6;
      const color = NOTES_COLORS[Math.floor(prng() * NOTES_COLORS.length)];
      tiles.push({
        key: `tile-${row * NOTES_COLUMNS + col}`,
        style: {
          backgroundColor: color,
          left: `${left}%`,
          top: `${top}%`,
          width: `${size}px`,
          height: `${size}px`,
          "--delay": `${delay}ms`,
          "--cluster-x": `${clusterX}px`,
          "--cluster-y": `${clusterY}px`,
          "--rotation": `${rotation}deg`,
        },
      });
    }
  }
  return tiles;
}

function buildLogoStyle() {
  const prng = mulberry32(LOGO_SEED);
  const x = (prng() - 0.5) * 160;
  const y = (prng() - 0.5) * 120;
  const rotation = (prng() - 0.5) * 18;
  const delay = 180 + prng() * 260;
  return {
    "--logo-x": `${x}px`,
    "--logo-y": `${y}px`,
    "--logo-r": `${rotation}deg`,
    "--logo-delay": `${delay}ms`,
  };
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function truncateMiddle(value, start = 6, end = 4) {
  if (!value) {
    return "";
  }
  if (value.length <= start + end + 3) {
    return value;
  }
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function normalizeMediaValue(value) {
  if (typeof value !== "string") {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("ipfs://")) {
    return buildGatewayUrls(trimmed);
  }
  if (trimmed.startsWith("ar://")) {
    return [`https://arweave.net/${trimmed.slice(5)}`];
  }
  return [trimmed];
}

function collectMediaCandidates(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectMediaCandidates(entry));
  }
  if (typeof value === "object") {
    return Object.values(value).flatMap((entry) => collectMediaCandidates(entry));
  }
  return normalizeMediaValue(value);
}

function buildImageCandidates(token) {
  const candidates = new Set();
  const metadata = token?.metadata && typeof token.metadata === "object" ? token.metadata : null;
  const sources = [
    token?.image,
    metadata?.image,
    metadata?.image_url,
    metadata?.imageUrl,
    metadata?.imageURI,
    metadata?.image_uri,
    metadata?.preview,
    metadata?.thumbnail,
    metadata?.preview_gif,
    metadata?.animation_url,
    metadata?.animationUrl,
  ];
  sources.forEach((source) => {
    collectMediaCandidates(source).forEach((url) => candidates.add(url));
  });
  return Array.from(candidates);
}

function parseNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, ".");
    const match = normalized.match(/-?\d+(\.\d+)?/);
    if (!match) {
      return null;
    }
    const parsed = Number.parseFloat(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatFeingehalt(value, numeric) {
  if (!value) {
    return null;
  }
  if (numeric == null) {
    return value.trim();
  }
  const formatted = (Math.trunc(numeric * 10000) / 10000)
    .toFixed(4)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
  return formatted;
}

function extractFeingehalt(token) {
  if (token?.mintPriceEth) {
    return String(token.mintPriceEth);
  }
  const metadata = token?.metadata && typeof token.metadata === "object" ? token.metadata : null;
  if (!metadata) {
    return null;
  }
  if (metadata.feingehalt != null) {
    return String(metadata.feingehalt);
  }
  const attributes =
    metadata.attributes ||
    metadata.traits ||
    metadata.properties?.attributes ||
    metadata.properties?.traits ||
    [];
  const list = Array.isArray(attributes) ? attributes : [attributes];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const label =
      entry.trait_type || entry.traitType || entry.type || entry.name || "";
    if (String(label).trim().toLowerCase() !== "feingehalt") {
      continue;
    }
    const raw = entry.value ?? entry.val ?? entry.amount;
    if (raw != null) {
      return String(raw);
    }
  }
  return null;
}

function formatMintDate(value) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toISOString().split("T")[0];
}

function buildViewerUrl(tokenId) {
  return buildBuilderTokenViewUrl(tokenId) || `/m2/${tokenId}`;
}

function ImageCandidate({
  candidates = [],
  alt,
  className,
  placeholderClassName,
  placeholderLabel = "No preview resolved",
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const signature = useMemo(() => candidates.join("|"), [candidates]);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [signature]);

  if (!candidates.length || failed) {
    return <div className={placeholderClassName}>{placeholderLabel}</div>;
  }

  return (
    <img
      src={candidates[index]}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (index < candidates.length - 1) {
          setIndex((value) => value + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

function DigOverlay() {
  const [open, setOpen] = useState(false);
  const headingId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="landing-button secondary landing-button-dig"
        onClick={() => setOpen(true)}
      >
        Dig it
      </button>
      {open ? (
        <div
          className="dig-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
        >
          <button
            type="button"
            className="dig-overlay-backdrop"
            aria-label="Close overlay"
            onClick={() => setOpen(false)}
          ></button>
          <div className="dig-overlay-panel">
            <div className="dig-overlay-header">
              <h2 className="dig-overlay-title" id={headingId}>
                Contextualized Rarity as Inversion
              </h2>
              <button
                type="button"
                className="dig-overlay-close"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="dig-overlay-body">
              <p>
                NFT-native digital art forces a reconsideration of rarity. In a medium where images
                are infinitely replicable and traits are algorithmically enumerable, scarcity at the
                level of form is largely synthetic.
              </p>
              <p>
                Cubixles starts from a different premise: the only element that is conceptually rare
                in NFT space is contextualized provenance.
              </p>
              <div className="dig-overlay-staccato">
                <span>Images can be copied.</span>
                <span>Styles can be forked.</span>
                <span>Traits can be regenerated.</span>
              </div>
              <p>
                But the specific, verifiable context of ownership relations - who owned what, when,
                and how those works were brought into relation - is irreducible.
              </p>
              <p>Cubixles consolidates this insight into three aligned layers:</p>
              <dl className="dig-overlay-layers">
                <div>
                  <dt>Principle</dt>
                  <dd>
                    Rarity in NFTs does not emerge from visual uniqueness, but from contextualized
                    lineage - the historically specific configuration of ownership and reference.
                  </dd>
                </div>
                <div>
                  <dt>Primitive</dt>
                  <dd>
                    Provenance itself becomes the creator market primitive: a composable,
                    ownership-verified relation between tokens.
                  </dd>
                </div>
                <div>
                  <dt>Mechanism</dt>
                  <dd>
                    The minting process binds the verifiable provenance of NFTs a user already owns
                    into a new token, making contextual rarity executable and material.
                  </dd>
                </div>
              </dl>
              <p>
                In this framework, rarity is no longer a property of images or traits. It is a
                property of relations.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function LandingCubeIcon() {
  return (
    <div className="landing-cube-icon" data-cube-icon="true" aria-hidden="true">
      <div className="landing-sketch-shell">
        <img
          src="/assets/default-cube.svg"
          alt=""
          className="landing-sketch-canvas"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </div>
  );
}

function NotesOverlayMotion() {
  useEffect(() => {
    const overlay = document.querySelector("[data-notes-overlay]");
    if (!overlay) {
      return;
    }
    let fadeTimeout = null;
    let dockTimeout = null;
    let raf = null;
    let onDelayTimeout = null;
    let maxDelay = 0;

    const setFadeDuration = (value) => {
      document.body.style.setProperty(
        "--cube-fade-duration",
        `${Math.max(0, value)}ms`
      );
    };

    const activateCube = () => {
      document.body.classList.add("cube-fade-in");
    };

    const STORAGE_KEY = "cubixles_notes_flock_v1";
    const NAVIGATE = "navigate";
    const getNavigationType = () => {
      if (typeof performance === "undefined") {
        return NAVIGATE;
      }
      const entries = performance.getEntriesByType?.("navigation");
      const entry = entries?.[0];
      if (entry?.type) {
        return entry.type;
      }
      const legacy = performance.navigation;
      return legacy?.type === 1 ? "reload" : NAVIGATE;
    };

    const getOrientationKey = () => {
      const orientation = window.screen?.orientation?.type;
      if (orientation) {
        return orientation;
      }
      const { innerWidth, innerHeight } = window;
      return `ratio-${(innerHeight ? innerHeight / innerWidth : 0).toFixed(2)}`;
    };

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      let parsed = null;
      if (stored) {
        try {
          parsed = JSON.parse(stored);
        } catch (error) {
          parsed = { v: 1 };
        }
      }
      const navigation = getNavigationType();
      const orientation = getOrientationKey();
      const sameOrientation = !parsed || !parsed.orientation || parsed.orientation === orientation;
      if (parsed && !(navigation === "reload" && sameOrientation)) {
        setFadeDuration(600);
        activateCube();
        overlay.classList.add("dock");
        document.body.classList.add("notes-docked");
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            v: 2,
            orientation,
            lastRun: parsed?.lastRun ?? 0,
          })
        );
        return;
      }
      maxDelay = Date.now();
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: 2, orientation, lastRun: maxDelay })
      );
    } catch (error) {
      void error;
    }

    overlay.classList.remove("flock");
    overlay.classList.remove("dock");
    document.body.classList.remove("notes-docked");
    document.body.classList.remove("cube-fade-in");

    raf = window.requestAnimationFrame(() => {
      const cube = document.querySelector("[data-cube-icon]");
      const fallback = { x: 0.78 * window.innerWidth, y: 0.2 * window.innerHeight };
      let targetX = fallback.x;
      let targetY = fallback.y;
      if (cube) {
        const rect = cube.getBoundingClientRect();
        targetX = rect.left + rect.width / 2;
        targetY = rect.top + rect.height / 2;
      }
      const tiles = Array.from(overlay.querySelectorAll(".notes-tile"));
      maxDelay = 0;
      tiles.forEach((tile) => {
        const rect = tile.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = targetX - centerX;
        const dy = targetY - centerY;
        const delay = Number.parseFloat(tile.style.getPropertyValue("--delay") || "0");
        maxDelay = Math.max(maxDelay, delay);
        tile.style.setProperty("--dx", `${dx}px`);
        tile.style.setProperty("--dy", `${dy}px`);
      });
      setFadeDuration(Math.max(0, maxDelay + 1800 + 520 - 150));
      fadeTimeout = window.setTimeout(() => {
        overlay.classList.add("flock");
        onDelayTimeout = window.setTimeout(() => activateCube(), 150);
      }, 1400);
      dockTimeout = window.setTimeout(() => {
        overlay.classList.add("dock");
        document.body.classList.add("notes-docked");
      }, 1400 + maxDelay + 1800);
    });

    return () => {
      if (fadeTimeout) {
        window.clearTimeout(fadeTimeout);
      }
      if (dockTimeout) {
        window.clearTimeout(dockTimeout);
      }
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
      if (onDelayTimeout) {
        window.clearTimeout(onDelayTimeout);
      }
      document.body.classList.remove("notes-docked");
      document.body.classList.remove("cube-fade-in");
      document.body.style.removeProperty("--cube-fade-duration");
    };
  }, []);

  return null;
}

function PaletteSync() {
  useEffect(() => {
    let mounted = true;

    const normalizeHex = (value) => {
      const trimmed = value.trim().replace("#", "").toUpperCase();
      if (!trimmed) {
        return "";
      }
      if (trimmed.length === 3) {
        return `#${trimmed
          .split("")
          .map((char) => `${char}${char}`)
          .join("")}`;
      }
      if (trimmed.length >= 6) {
        return `#${trimmed.slice(0, 6)}`;
      }
      return `#${trimmed.padEnd(6, "0")}`;
    };

    const luminance = (hex) => {
      const cleaned = normalizeHex(hex).replace("#", "").padEnd(6, "0");
      const rgb = {
        r: parseInt(cleaned.slice(0, 2), 16),
        g: parseInt(cleaned.slice(2, 4), 16),
        b: parseInt(cleaned.slice(4, 6), 16),
      };
      const toLinear = (channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : Math.pow((normalized + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
    };

    const contrastRatio = (a, b) => {
      const lumA = luminance(a);
      const lumB = luminance(b);
      return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
    };

    const pickContrast = (color) =>
      contrastRatio(color, "#000000") >= contrastRatio(color, "#FFFFFF")
        ? "#000000"
        : "#FFFFFF";

    const applyPalette = (palette) => {
      if (!mounted) {
        return;
      }
      const targets = Array.from(
        document.querySelectorAll(".landing-home, .token-page-neo")
      );
      if (!targets.length) {
        return;
      }
      const colors = palette.colors;
      const sorted = [...colors].sort((a, b) => luminance(a) - luminance(b));
      const base = sorted[sorted.length - 1];
      const surface = sorted.length > 1 ? sorted[sorted.length - 2] : base;
      const gridCandidates = colors.filter((color) => color !== base);
      const grid = (gridCandidates.length ? gridCandidates : colors).reduce((best, color) => {
        const diff = Math.abs(luminance(best) - luminance(base));
        return Math.abs(luminance(color) - luminance(base)) < diff ? color : best;
      }, base);
      const primary = colors[0] ?? base;
      const secondary = colors[1] ?? primary;
      const accent = colors[2] ?? secondary;
      const mint = colors[3] ?? accent;
      const border =
        Math.min(contrastRatio(base, "#000000"), contrastRatio(surface, "#000000")) >=
        Math.min(contrastRatio(base, "#FFFFFF"), contrastRatio(surface, "#FFFFFF"))
          ? "#000000"
          : "#FFFFFF";
      const onSurface = pickContrast(surface);
      const onPrimary = pickContrast(primary);
      const onSecondary = pickContrast(secondary);
      const onAccent = pickContrast(accent);
      const onMint = pickContrast(mint);
      targets.forEach((target) => {
        target.style.setProperty("--neo-bg", base);
        target.style.setProperty("--neo-surface", surface);
        target.style.setProperty("--neo-border", border);
        target.style.setProperty("--neo-text", border);
        target.style.setProperty("--neo-muted", border);
        target.style.setProperty("--neo-primary", primary);
        target.style.setProperty("--neo-secondary", secondary);
        target.style.setProperty("--neo-accent", accent);
        target.style.setProperty("--neo-mint", mint);
        target.style.setProperty("--neo-grid", grid);
        target.style.setProperty("--neo-on-surface", onSurface);
        target.style.setProperty("--neo-on-primary", onPrimary);
        target.style.setProperty("--neo-on-secondary", onSecondary);
        target.style.setProperty("--neo-on-accent", onAccent);
        target.style.setProperty("--neo-on-mint", onMint);
        target.dataset.paletteId = palette.id;
      });
    };

    const loadPalette = async () => {
      try {
        const response = await fetch("/assets/generative_plot/manifest.json", { cache: "no-store" });
        if (!response.ok) {
          applyPalette(DEFAULT_PALETTE);
          return;
        }
        const payload = await response.json();
        if (!Array.isArray(payload) || payload.length === 0) {
          applyPalette(DEFAULT_PALETTE);
          return;
        }
        const palette = payload[Math.floor(Math.random() * payload.length)];
        const colors = Array.from(
          new Set(
            ((palette?.hex_colors?.length ? palette.hex_colors : palette?.used_hex_colors) || [])
              .map((color) => normalizeHex(color))
              .filter(Boolean)
          )
        );
        const filtered = colors.length ? colors : DEFAULT_PALETTE.colors;
        const normalized = [];
        for (let i = 0; i < 4; i += 1) {
          normalized.push(filtered[i % filtered.length]);
        }
        applyPalette({
          id: palette?.palette_id ?? DEFAULT_PALETTE.id,
          colors: normalized,
        });
      } catch (error) {
        applyPalette(DEFAULT_PALETTE);
      }
    };

    loadPalette();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}

function TokenIndex() {
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_ID);
  const [mode, setMode] = useState("page");
  const [tokens, setTokens] = useState([]);
  const [pageKey, setPageKey] = useState(null);
  const [pages, setPages] = useState(1);
  const [truncated, setTruncated] = useState(false);
  const [pageSizeInput, setPageSizeInput] = useState(DEFAULT_PAGE_SIZE);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [maxPages, setMaxPages] = useState(DEFAULT_MAX_PAGES);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const isAllMode = mode === "all";
  const hasMorePages = Boolean(pageKey);
  const pageSizeId = "token-index-page-size";
  const maxPagesId = "token-index-max-pages";
  const debouncedPageSize = useDebounced(pageSizeInput, 300);

  const fetchTokens = useCallback(
    async ({ reset, nextPageKey }) => {
      setStatus("loading");
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("chainId", String(chainId));
        params.set("mode", "builder");
        if (isAllMode) {
          params.set("all", "true");
          params.set("maxPages", String(maxPages));
        } else if (nextPageKey) {
          params.set("pageKey", String(nextPageKey));
        }
        const response = await fetch(`/api/tokens?${params.toString()}`, {
          cache: "no-store",
        });
        const text = await response.text();
        let data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            if (response.ok) {
              throw new Error("Token list response was malformed.");
            }
          }
        }
        if (!response.ok) {
          throw new Error(data?.error || `Token list request failed (${response.status}).`);
        }
        if (!data) {
          throw new Error("Token list response was empty.");
        }
        const nextTokens = Array.isArray(data.tokens) ? data.tokens : [];
        if (isAllMode || reset) {
          setTokens(nextTokens);
        } else {
          setTokens((current) => {
            const seen = new Set(current.map((token) => token.tokenId));
            const merged = [...current];
            nextTokens.forEach((token) => {
              if (!seen.has(token.tokenId)) {
                merged.push(token);
              }
            });
            return merged;
          });
        }
        setPageKey(data.pageKey ?? null);
        setPages(data.pages ?? 1);
        setTruncated(Boolean(data.truncated));
        setStatus("idle");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus("error");
        setError(message);
      }
    },
    [chainId, isAllMode, maxPages, pageSize]
  );

  useEffect(() => {
    fetchTokens({ reset: true, nextPageKey: null });
  }, [fetchTokens, refreshTick]);

  useEffect(() => {
    if (!tokens.length) {
      setHighlightIndex(0);
      return;
    }
    setHighlightIndex((value) => (value < tokens.length ? value : 0));
  }, [tokens.length]);

  useEffect(() => {
    if (!tokens.length || hoverIndex !== null) {
      return;
    }
    const interval = window.setInterval(() => {
      setHighlightIndex((value) => (tokens.length ? (value + 1) % tokens.length : 0));
    }, 1500);
    return () => window.clearInterval(interval);
  }, [tokens.length, hoverIndex]);

  const statusMessage = useMemo(() => {
    if (status === "loading") {
      return "Loading collection tokens...";
    }
    if (isAllMode) {
      if (truncated) {
        return `Loaded ${tokens.length} tokens across ${pages} pages (truncated).`;
      }
      return `Loaded ${tokens.length} tokens across ${pages} pages.`;
    }
    if (tokens.length) {
      return hasMorePages
        ? `Loaded ${tokens.length} tokens. More pages available.`
        : `Loaded ${tokens.length} tokens. End of list.`;
    }
    return "No tokens loaded yet.";
  }, [hasMorePages, isAllMode, pages, status, tokens.length, truncated]);

  const tokenEntries = useMemo(() => {
    return tokens
      .map((token) => {
        const feingehaltLabel = extractFeingehalt(token);
        const feingehaltSort = parseNumeric(feingehaltLabel);
        const feingehaltDisplay = feingehaltLabel
          ? formatFeingehalt(feingehaltLabel, feingehaltSort)
          : null;
        return { token, feingehaltDisplay, feingehaltSort };
      })
      .sort((a, b) => {
        if (a.feingehaltSort == null && b.feingehaltSort == null) {
          return String(a.token.tokenId).localeCompare(String(b.token.tokenId));
        }
        if (a.feingehaltSort == null) {
          return 1;
        }
        if (b.feingehaltSort == null) {
          return -1;
        }
        if (a.feingehaltSort === b.feingehaltSort) {
          return String(a.token.tokenId).localeCompare(String(b.token.tokenId));
        }
        return b.feingehaltSort - a.feingehaltSort;
      });
  }, [tokens]);

  const activeIndex = hoverIndex != null ? hoverIndex : highlightIndex;

  return (
    <section className="provenance-panel token-index-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">Live index</p>
          <h2 className="panel-title">Chain token list</h2>
          <p className="panel-subhead">{TOKEN_LIST_COPY}</p>
        </div>
        <div className="token-index-actions">
          <div className="token-index-network" role="group" aria-label="Network">
            <span className="token-detail-label">Network</span>
            <div className="token-chain-buttons">
              <button
                type="button"
                className={`token-chain-button${chainId === 1 ? " is-active" : ""}`}
                onClick={() => setChainId(1)}
              >
                Ethereum
              </button>
            </div>
          </div>
          <label className="token-index-control" htmlFor={pageSizeId}>
            <span>Page size</span>
            <input
              id={pageSizeId}
              type="number"
              min={1}
              max={100}
              value={pageSizeInput}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(next)) {
                  setPageSizeInput(Math.min(Math.max(next, 1), 100));
                }
              }}
              className="token-index-input"
            />
          </label>
          <label className="token-index-control" htmlFor={maxPagesId}>
            <span>All-mode max pages</span>
            <input
              id={maxPagesId}
              type="number"
              min={1}
              max={50}
              value={maxPages}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(next)) {
                  setMaxPages(Math.min(Math.max(next, 1), 50));
                }
              }}
              className="token-index-input"
            />
          </label>
          <button
            type="button"
            className="landing-button secondary"
            onClick={() => setMode((value) => (value === "all" ? "page" : "all"))}
            disabled={status === "loading"}
          >
            {isAllMode ? "Use pagination" : `Load all (max ${maxPages} pages)`}
          </button>
          {!isAllMode ? (
            <button
              type="button"
              className="landing-button primary"
              onClick={() => {
                if (status !== "loading" && hasMorePages && !isAllMode) {
                  fetchTokens({ reset: false, nextPageKey: pageKey });
                }
              }}
              disabled={!hasMorePages || status === "loading"}
            >
              {hasMorePages ? "Load more" : "End of list"}
            </button>
          ) : null}
          <button
            type="button"
            className="landing-button tertiary"
            onClick={() => {
              setPageSize(debouncedPageSize === pageSizeInput ? debouncedPageSize : pageSizeInput);
              setRefreshTick((value) => value + 1);
            }}
            disabled={status === "loading"}
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="token-index-status">{statusMessage}</p>
      {error ? <p className="token-index-error">Error: {error}</p> : null}
      <div className="token-index-carousel">
        {tokenEntries.map((entry, index) => {
          const { token, feingehaltDisplay } = entry;
          const tokenId = String(token.tokenId || "");
          const shortId = truncateMiddle(tokenId);
          const title =
            token.title || token.name || token.metadata?.name || `Token ${tokenId}`;
          const displayTitle = title.includes(tokenId)
            ? title.replace(tokenId, shortId)
            : title;
          const candidates = buildImageCandidates(token);
          const viewerUrl = buildViewerUrl(tokenId);
          const isHighlighted = index === activeIndex;
          return (
            <a
              key={tokenId}
              href={viewerUrl}
              className={`token-index-card${isHighlighted ? " is-highlighted" : ""}`}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
              aria-label={`Inspect token ${tokenId}`}
            >
              <div className="token-index-media">
                <ImageCandidate
                  candidates={candidates}
                  alt={`Token ${tokenId} preview`}
                  placeholderClassName="token-index-media-placeholder"
                  placeholderLabel="No preview resolved"
                />
              </div>
              <div className="token-index-card-head">
                <span className="panel-face-label">Token</span>
                <span className="token-index-id" title={tokenId}>
                  {shortId}
                </span>
              </div>
              <p className="token-index-title" title={title}>
                <CubixlesText text={displayTitle} />
              </p>
              <p className="token-index-copy token-index-feingehalt">
                <span className="token-index-feingehalt-label">Feingehalt</span>{" "}
                <span className="token-index-feingehalt-value">
                  {feingehaltDisplay ?? "n/a"}
                </span>
              </p>
              <div className="token-index-meta">
                <span>Minted {formatMintDate(token.mint?.timestamp)}</span>
                <span>Tx {token.mint?.transactionHash ? "available" : "n/a"}</span>
              </div>
              <div className="token-index-links">
                <span className="landing-button secondary token-index-inspect">Inspect token</span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export default function ShaolinDeckPage() {
  const notesTiles = useMemo(() => buildNotesTiles(), []);
  const logoStyle = useMemo(() => buildLogoStyle(), []);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    body.style.overflow = "auto";
    root.style.overflow = "auto";
    return () => {
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
    };
  }, []);

  return (
    <>
      <NotesOverlayMotion />
      <PaletteSync />
      {FLOATING_TILES.map((tile) => (
        <a
          key={tile.href}
          className="floating-tile"
          href={tile.href}
          target="_blank"
          rel="noreferrer"
        >
          <span className="sr-only">{tile.label}</span>
          {tile.colors.map((color, index) => (
            <span
              key={`${tile.href}-${color}-${index}`}
              className="floating-cubelet"
              style={{ backgroundColor: color }}
            ></span>
          ))}
        </a>
      ))}
      <main className="landing-page landing-home">
        <div className="notes-overlay" data-notes-overlay="true" aria-hidden="true">
          {notesTiles.map((tile) => (
            <div key={tile.key} className="notes-tile" style={tile.style}></div>
          ))}
          <div className="notes-logo cubixles-logo" aria-hidden="true">
            <span className="notes-logo-letter" style={logoStyle}>
              {CUBIXLES_LOGO_GLYPH}
            </span>
          </div>
        </div>
        <section className="landing-header">
          <div className="landing-intro">
            <h1 className="landing-title">
              <span className="deck-logo-wrap">
                <a href="https://www.cubixles.xyz" className="cubixles-logo-link">
                  <CubixlesLogo />
                </a>
                <span className="deck-logo-scribble" aria-hidden="true">
                  banger bootlegs
                </span>
              </span>
            </h1>
            <p className="landing-subhead">
              Provenance as building blocks, NFTs as materials, and citations as structure.
            </p>
            <div className="landing-ctas">
              <a href="#token-list" className="landing-button primary">
                Browse token list
              </a>
              <a
                href="https://www.cubixles.xyz"
                className="landing-button platinum"
                target="_blank"
                rel="noreferrer"
              >
                Mint your own
              </a>
              <DigOverlay />
            </div>
          </div>
          <LandingCubeIcon />
        </section>
        <section id="token-list" className="landing-token-list">
          <TokenIndex />
        </section>
        <footer className="landing-watermark">
          hat's off to{" "}
          <a
            href="https://www.paypal.com/paypalme/Ballabani"
            target="_blank"
            rel="noreferrer"
          >
            https://marjoballabani.me/
          </a>
        </footer>
      </main>
    </>
  );
}
