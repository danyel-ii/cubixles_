import type { CSSProperties } from "react";
import { PALETTE_COLORS } from "../_data/paletteColors";
import { CUBIXLES_LOGO_GLYPH } from "../_lib/logo";
import NotesFlockAnimator from "./NotesFlockAnimator";

type NoteTile = {
  id: string;
  rotation: number;
  color: string;
  left: string;
  top: string;
  size: string;
  delay: string;
  clusterX: string;
  clusterY: string;
};

const TILE_COUNT = 800;
const TILE_COLS = 32;
const TILE_ROWS = Math.ceil(TILE_COUNT / TILE_COLS);

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const NOTE_TILES: NoteTile[] = Array.from({ length: TILE_COUNT }).map(
  (_, index) => {
    const rand = seededRandom(index + 1);
    const rotation = (rand() - 0.5) * 26;
    const color =
      PALETTE_COLORS[Math.floor(rand() * PALETTE_COLORS.length)] ?? "#F5F2F2";
    const baseCol = index % TILE_COLS;
    const baseRow = Math.floor(index / TILE_COLS);
    const cellWidth = 100 / TILE_COLS;
    const cellHeight = 100 / TILE_ROWS;
    const jitterX = (rand() - 0.5) * cellWidth * 0.9;
    const jitterY = (rand() - 0.5) * cellHeight * 0.9;
    const left = clampPercent((baseCol + 0.5) * cellWidth + jitterX);
    const top = clampPercent((baseRow + 0.5) * cellHeight + jitterY);
    const size = 66 + rand() * 28;
    const delay = 350 + rand() * 1900;
    const clusterX = (rand() - 0.5) * 130;
    const clusterY = (rand() - 0.5) * 130;

    return {
      id: `tile-${index}`,
      rotation,
      color,
      left: `${left}%`,
      top: `${top}%`,
      size: `${size}px`,
      delay: `${delay}ms`,
      clusterX: `${clusterX}px`,
      clusterY: `${clusterY}px`,
    };
  }
);

const LOGO_GLYPHS = [CUBIXLES_LOGO_GLYPH];
const LOGO_LETTERS = LOGO_GLYPHS.map((glyph, index) => {
  const rand = seededRandom(900 + index);
  return {
    glyph,
    offsetX: `${(rand() - 0.5) * 160}px`,
    offsetY: `${(rand() - 0.5) * 120}px`,
    rotation: `${(rand() - 0.5) * 24}deg`,
    delay: `${120 + rand() * 260}ms`,
  };
});

export default function NotesFlockOverlay() {
  return (
    <div className="notes-overlay" data-notes-overlay aria-hidden="true">
      {NOTE_TILES.map((tile) => (
        <div
          key={tile.id}
          className="notes-tile"
          style={
            {
              backgroundColor: tile.color,
              left: tile.left,
              top: tile.top,
              width: tile.size,
              height: tile.size,
              "--delay": tile.delay,
              "--cluster-x": tile.clusterX,
              "--cluster-y": tile.clusterY,
              "--rotation": `${tile.rotation}deg`,
            } as CSSProperties
          }
        />
      ))}
      <div className="notes-logo cubixles-logo" aria-hidden="true">
        {LOGO_LETTERS.map((letter, index) => (
          <span
            key={`${letter.glyph}-${index}`}
            className="notes-logo-letter"
            style={
              {
                "--logo-x": letter.offsetX,
                "--logo-y": letter.offsetY,
                "--logo-r": letter.rotation,
                "--logo-delay": letter.delay,
              } as CSSProperties
            }
          >
            {letter.glyph}
          </span>
        ))}
      </div>
      <NotesFlockAnimator />
    </div>
  );
}
