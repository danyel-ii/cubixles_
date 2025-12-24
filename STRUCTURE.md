# cubeless Code Structure

## Review Status

- Last reviewed: 2025-12-23
- Review status: Needs confirmation
- Owner: TBD

Frontend code lives under `frontend/` and contracts live under `contracts/`.
The p5.js sketch still uses global callbacks, but the UI, data, and feature
logic are split into smaller modules.

## Module Map

- `frontend/index.html`
  - App shell with the main UI panels.
- `frontend/src/main.js`
  - Bootstraps the p5 lifecycle registration and browser polyfills.
- `frontend/src/app/app-config.js`
  - Central constants (image URLs, cube size, zoom bounds, background file).
- `frontend/src/app/app-state.js`
  - Runtime state: textures, camera rotation/zoom, backdrop buffers, input state.
- `frontend/src/app/app-utils.js`
  - Shared helpers (IPFS URL resolve, face fill helpers, texture sizing).
- `frontend/src/app/app-scene.js`
  - Lighting setup for the WEBGL scene.
- `frontend/src/app/app-backdrop.js`
  - Background loader, gradient fallback, layered 3D backdrop, foreground overlay.
- `frontend/src/app/app-cube.js`
  - Cube faces and glass shell rendering.
- `frontend/src/app/app-edges.js`
  - Wobbly ink edge generation and rendering.
- `frontend/src/app/app-interaction.js`
  - Mouse/touch rotation and zoom handlers.
- `frontend/src/app/app-lifecycle.js`
  - p5 lifecycle callbacks (`preload`, `setup`, `draw`) plus event wiring.
- `frontend/src/app/app-exporter.js`
  - Standalone HTML export, asset embedding, background data URL fetch.
- `frontend/src/ui/ui-root.js`
  - UI entry point (overlay, wallet, picker, mint, leaderboard).
- `frontend/src/ui/overlay.js`
  - First-run overlay behavior.
- `frontend/src/ui/local-textures.js`
  - Local image picker for manual cube textures.
- `frontend/src/ui/export-ui.js`
  - Export HTML button wiring.
- `frontend/src/ui/leaderboard.js`
  - Leaderboard placeholder panel.
- `frontend/src/features/wallet/wallet.js`
  - Wallet connection state + provider handshake.
- `frontend/src/features/wallet/wallet-ui.js`
  - Wallet connect/disconnect UI binding.
- `frontend/src/features/nft/picker-ui.js`
  - NFT selection UI + cube texture application.
- `frontend/src/features/mint/mint-ui.js`
  - Mint flow, floor snapshot UI, and diagnostics.
- `frontend/src/features/mint/mint-metadata.js`
  - Mint metadata + provenance shaping.
- `frontend/src/features/mint/token-uri-provider.js`
  - Token URI encoding helper.
- `frontend/src/data/alchemy/client.ts`
  - Alchemy NFT API wrapper (mainnet + Sepolia).
- `frontend/src/data/nft/indexer.ts`
  - Inventory + provenance fetchers.
- `frontend/src/data/nft/floor.js`
  - Floor price snapshot helper (mainnet only).
- `frontend/src/shared/utils/uri.ts`
  - URI normalization and resolution helpers.
- `frontend/src/types/provenance.ts`
  - Shared NFT/provenance types.

## Contracts Layout

- `contracts/src/icecube/IceCubeMinter.sol`
  - ERC-721 minting contract with ownership gating + ERC-2981.
- `contracts/src/royalties/RoyaltySplitter.sol`
  - Royalty receiver that can swap for $LESS and forward proceeds.
- `contracts/src/mocks/Counter.sol`
  - Foundry sample contract used by tests/scripts.
- `contracts/script/DeployIceCube.s.sol`
  - Deploys RoyaltySplitter + IceCubeMinter and writes Sepolia deployment JSON.
- `contracts/scripts/export-abi.mjs`
  - Exports IceCubeMinter ABI from the Foundry output directory.
- `contracts/test/*.t.sol`
  - Foundry tests for core contract behavior.

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
