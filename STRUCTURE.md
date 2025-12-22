# IceCube Code Structure

This project uses lightweight, global modules attached to `window.App` to keep
the p5.js sketch modular while still working with p5’s global callbacks.

## Module Map

- `src/app/app-config.js`
  - Central constants (image URLs, cube size, zoom bounds, background file).
- `src/app/app-state.js`
  - Runtime state: textures, camera rotation/zoom, backdrop buffers, input state.
- `src/app/app-utils.js`
  - Small shared helpers (IPFS URL resolve, face fill helpers).
- `src/app/app-scene.js`
  - Lighting setup for the WEBGL scene.
- `src/app/app-backdrop.js`
  - Background loader, gradient fallback, layered 3D backdrop, foreground overlay.
- `src/app/app-cube.js`
  - Cube faces and glass shell rendering.
- `src/app/app-edges.js`
  - Wobbly ink edge generation and rendering.
- `src/app/app-interaction.js`
  - Mouse/touch rotation and zoom handlers.
- `src/app/app-ui.js`
  - Image picker, local texture loading, and UI wiring.
- `src/app/app-exporter.js`
  - Standalone HTML export, asset embedding, background data URL fetch.
- `src/main.js`
  - p5 entry points (`preload`, `setup`, `draw`, event handlers) that delegate to modules.

## Rendering Flow

1. `preload` loads default textures and background.
2. `setup` initializes the canvas, backdrop buffers, edge geometry, and UI.
3. `draw` renders:
   - layered background
   - cube faces + glass shell
   - ink wireframe edges
   - foreground backdrop overlay

## Export Flow

1. Pick up to 6 local images via the UI.
2. Click “Export HTML” to save a single HTML file.
3. The export embeds selected images and the current background as data URLs.
