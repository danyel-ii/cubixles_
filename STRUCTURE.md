# cubeless Code Structure

## Review Status

- Last reviewed: 2025-12-25
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
- `frontend/src/config/links.js`
  - Token-view URL + GIF library CID helpers.
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
  - UI entry point (panels + HUDs).
- `frontend/src/ui/panels/overlay.js`
  - First-run overlay behavior.
- `frontend/src/ui/panels/local-textures.js`
  - Local image picker for manual cube textures.
- `frontend/src/ui/panels/export-ui.js`
  - Export HTML button wiring.
- `frontend/src/ui/panels/leaderboard.js`
  - Leaderboard panel (ΔLESS ranking).
- `frontend/src/ui/panels/preview.js`
  - Mobile preview mode toggle.
- `frontend/src/ui/hud/eth-hud.js`
  - Bottom-right ΔLESS HUD display.
- `frontend/src/ui/hud/less-hud.js`
  - Bottom-left $LESS supply HUD display.
- `frontend/src/ui/hud/less-delta.js`
  - Wallet-driven ΔLESS tracking for the HUD.
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
- `frontend/src/data/chain/alchemy-client.ts`
  - Alchemy NFT API wrapper (mainnet + Sepolia).
- `frontend/src/data/chain/icecube-reader.js`
  - Reads tokenURI via JSON-RPC (no wallet required).
- `frontend/src/data/chain/less-supply.js`
  - Mainnet $LESS totalSupply fetcher (Alchemy JSON-RPC).
- `frontend/src/data/chain/less-delta.js`
  - Onchain ΔLESS fetcher (deltaFromLast/deltaFromMint).
- `frontend/src/data/nft/indexer.ts`
  - Inventory + provenance fetchers.
- `frontend/src/data/nft/floor.js`
  - Floor price snapshot helper (mainnet only).
- `frontend/src/gif/params.js`
  - GIF parameter lookup tables.
- `frontend/src/gif/variant.js`
  - Deterministic GIF variant selection + IPFS path builder.
- `frontend/src/routes/token-view.js`
  - `/m/<tokenId>` viewer route for animation_url rendering.
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
- `contracts/test/fuzz/*.t.sol`
  - Fuzz tests for payment boundaries and ownership gating.
- `contracts/test/invariants/*.t.sol`
  - Invariant tests for mint value conservation and ERC-2981 receiver.
- `contracts/test/fork/*.t.sol`
  - Optional mainnet fork tests (requires `MAINNET_RPC_URL`).

## Security Docs

- `docs/security/THREAT_MODEL.md`
- `docs/security/INVARIANTS.md`
- `docs/security/KNOWN_LIMITATIONS.md`
- `docs/security/STATIC_ANALYSIS.md`

## Root Docs

- `MASTER_DOC.md`
  - Master index, glossary, and doc map.
- `docs/security/SECURITY_RUNBOOK.md`
- `docs/security/FORK_TESTING.md`

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

## Debug Helpers

- `scripts/gif-debug.mjs`
  - Deterministic GIF variant sanity check for a fixed input.
