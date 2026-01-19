"use client";

import { useEffect } from "react";

const FLOCK_DELAY_MS = 1400;
const MOVE_DURATION_MS = 1800;
const OVERLAY_FADE_MS = 520;
const FADE_START_DELAY_MS = 150;
const QUICK_FADE_MS = 600;
const FLOCK_STORAGE_KEY = "cubixles_notes_flock_v1";
const DEFAULT_NAV_TYPE = "navigate";

type FlockStorage = {
  v: number;
  orientation?: string;
  lastRun?: number;
};

const getNavigationType = () => {
  if (typeof performance === "undefined") {
    return DEFAULT_NAV_TYPE;
  }
  const entries = performance.getEntriesByType?.("navigation");
  const navEntry = entries?.[0] as PerformanceNavigationTiming | undefined;
  if (navEntry?.type) {
    return navEntry.type;
  }
  const legacyNav = (performance as Performance & { navigation?: { type: number } })
    .navigation;
  if (legacyNav?.type === 1) {
    return "reload";
  }
  return DEFAULT_NAV_TYPE;
};

const getOrientationKey = () => {
  const orientation = window.screen?.orientation?.type;
  if (orientation) {
    return orientation;
  }
  const { innerWidth, innerHeight } = window;
  const ratio = innerHeight ? innerWidth / innerHeight : 0;
  return `ratio-${ratio.toFixed(2)}`;
};

export default function NotesFlockAnimator() {
  useEffect(() => {
    const overlay = document.querySelector<HTMLElement>("[data-notes-overlay]");
    if (!overlay) {
      return;
    }

    let timeoutRef: number | null = null;
    let dockTimeoutRef: number | null = null;
    let animationFrameRef: number | null = null;
    let fadeTimeoutRef: number | null = null;
    let lastRun = 0;

    const setCubeFadeDuration = (durationMs: number) => {
      const clamped = Math.max(0, durationMs);
      document.body.style.setProperty("--cube-fade-duration", `${clamped}ms`);
    };

    const startCubeFade = () => {
      document.body.classList.add("cube-fade-in");
    };

    try {
      const storedRaw = window.localStorage.getItem(FLOCK_STORAGE_KEY);
      let stored: FlockStorage | null = null;
      if (storedRaw) {
        try {
          stored = JSON.parse(storedRaw) as FlockStorage;
        } catch {
          stored = { v: 1 };
        }
      }

      const navigationType = getNavigationType();
      const orientationKey = getOrientationKey();
      const orientationMatches = stored?.orientation
        ? stored.orientation === orientationKey
        : true;
      const shouldRun =
        !stored || (navigationType === "reload" && orientationMatches);

      if (!shouldRun) {
        setCubeFadeDuration(QUICK_FADE_MS);
        startCubeFade();
        overlay.classList.add("dock");
        document.body.classList.add("notes-docked");
        window.localStorage.setItem(
          FLOCK_STORAGE_KEY,
          JSON.stringify({
            v: 2,
            orientation: orientationKey,
            lastRun: stored?.lastRun ?? 0,
          })
        );
        return;
      }

      lastRun = Date.now();
      window.localStorage.setItem(
        FLOCK_STORAGE_KEY,
        JSON.stringify({ v: 2, orientation: orientationKey, lastRun })
      );
    } catch {
      // Ignore storage access errors (private mode, blocked storage).
    }

    const layoutTiles = () => {
      if (timeoutRef) {
        window.clearTimeout(timeoutRef);
      }
      if (dockTimeoutRef) {
        window.clearTimeout(dockTimeoutRef);
      }
      if (animationFrameRef) {
        window.cancelAnimationFrame(animationFrameRef);
      }
      if (fadeTimeoutRef) {
        window.clearTimeout(fadeTimeoutRef);
      }

      overlay.classList.remove("flock");
      overlay.classList.remove("dock");
      document.body.classList.remove("notes-docked");
      document.body.classList.remove("cube-fade-in");

      animationFrameRef = window.requestAnimationFrame(() => {
        const targetNode = document.querySelector<HTMLElement>("[data-cube-icon]");
        const fallbackTarget = {
          x: window.innerWidth * 0.78,
          y: window.innerHeight * 0.2,
        };
        let targetX = fallbackTarget.x;
        let targetY = fallbackTarget.y;

        if (targetNode) {
          const rect = targetNode.getBoundingClientRect();
          targetX = rect.left + rect.width / 2;
          targetY = rect.top + rect.height / 2;
        }

        const tilesNodes = Array.from(
          overlay.querySelectorAll<HTMLElement>(".notes-tile")
        );
        let maxDelay = 0;

        tilesNodes.forEach((tile) => {
          const rect = tile.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dx = targetX - centerX;
          const dy = targetY - centerY;
          const delayValue = Number.parseFloat(
            tile.style.getPropertyValue("--delay") || "0"
          );
          maxDelay = Math.max(maxDelay, delayValue);
          tile.style.setProperty("--dx", `${dx}px`);
          tile.style.setProperty("--dy", `${dy}px`);
        });

        const totalDuration = maxDelay + MOVE_DURATION_MS + OVERLAY_FADE_MS;
        setCubeFadeDuration(Math.max(0, totalDuration - FADE_START_DELAY_MS));

        timeoutRef = window.setTimeout(
          () => {
            overlay.classList.add("flock");
            fadeTimeoutRef = window.setTimeout(
              () => startCubeFade(),
              FADE_START_DELAY_MS
            );
          },
          FLOCK_DELAY_MS
        );
        dockTimeoutRef = window.setTimeout(() => {
          overlay.classList.add("dock");
          document.body.classList.add("notes-docked");
        }, FLOCK_DELAY_MS + maxDelay + MOVE_DURATION_MS);
      });
    };

    layoutTiles();

    return () => {
      if (timeoutRef) {
        window.clearTimeout(timeoutRef);
      }
      if (dockTimeoutRef) {
        window.clearTimeout(dockTimeoutRef);
      }
      if (animationFrameRef) {
        window.cancelAnimationFrame(animationFrameRef);
      }
      if (fadeTimeoutRef) {
        window.clearTimeout(fadeTimeoutRef);
      }
      document.body.classList.remove("notes-docked");
      document.body.classList.remove("cube-fade-in");
      document.body.style.removeProperty("--cube-fade-duration");
    };
  }, []);

  return null;
}
