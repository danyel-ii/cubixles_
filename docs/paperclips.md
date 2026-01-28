# Paperclips Artwork (CubesPaperClip)
Last updated: 2026-01-28

## Purpose
Paperclips are generative PNG artworks embedded in builder mints. They are unique per wallet and
recorded in builder metadata as `paperclip` and `paperclipImage`.

## Where it lives
- Model + layer generator: `app/_client/src/shared/paperclip-model.js`
- Canvas renderer: `app/_client/src/features/paperclip/cubes-paperclip.js`
- UI panel: `app/_client/src/features/paperclip/paperclip-ui.js`
- Server render + pinning: `src/server/paperclip.js` + `app/api/pin/builder-assets/route.js`

## How it is generated
### 1) Deterministic seed
The seed is derived from the wallet address (lowercased) during builder mint:
- See `app/_client/src/features/mint/builder-mint-ui.js`.

### 2) Palette resolution
A palette is chosen client-side via `resolvePaperclipPalette`:
- `app/_client/src/features/paperclip/paperclip-utils.js`.
- If no palette is resolved, the fallback palette in `paperclip-model.js` is used.

### 3) Layer model
`buildPaperclipLayers({ seed, palette })` produces a stack of layers:
- Each layer is a grid of holes carved out of a color field.
- Parameters per layer (grid size, hole probability, radius factor, square mix) are randomized
  via a deterministic RNG seeded from the wallet seed.
- Output includes a `layers` array and the palette used.

### 4) Canvas rendering
`renderCubesPaperClip({ canvas, seed, palette, overlay })` renders the art:
- Renders a background (#0b1220).
- For each layer, a mask is built using the grid parameters and then drawn with shadow.
- Optional overlay (QR code) is drawn in the lower-right quadrant.

### 5) Pinning
During builder mint asset pinning:
- `POST /api/pin/builder-assets` uses `src/server/paperclip.js` to render the PNG.
- The output is pinned to IPFS via Pinata and returned as `paperclipUrl`.

## Metadata fields
Builder metadata stores:
- `paperclip`: the generative spec (seed, palette, layers, size).
- `paperclipImage`: the IPFS URL for the rendered PNG.

## Customization knobs
- `seed`: derived from the wallet address, but can be overridden for testing.
- `palette`: array of hex colors; see `normalizePaperclipPalette`.
- `size`: default 1024 px, adjustable in the paperclip spec.
