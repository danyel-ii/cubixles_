# cubeless Code Structure

## Review Status

- Last reviewed: 2025-12-25
- Review status: Needs confirmation
- Owner: TBD

Frontend code now lives under the Next.js `app/` directory (app router), with
client-side modules in `app/_client/`. Contracts live under `contracts/`. The
p5.js sketch still uses global callbacks, but the UI, data, and feature logic
are split into smaller modules.

## Module Map

- `app/layout.jsx`
  - Global layout + p5 loader script.
- `app/ui/AppShell.jsx`
  - App shell markup + client entry import.
- `app/page.jsx`
  - Main route (`/`).
- `app/m/[tokenId]/page.jsx`
  - Token viewer route (`/m/<tokenId>`).
- `app/_client/src/main.js`
  - Bootstraps the p5 lifecycle registration and browser polyfills.
- `app/_client/src/config/links.js`
  - Token-view URL + GIF library CID helpers.
- `app/_client/src/app/app-config.js`
  - Central constants (image URLs, cube size, zoom bounds, background file).
- `app/_client/src/app/app-state.js`
  - Runtime state: textures, camera rotation/zoom, backdrop buffers, input state.
- `app/_client/src/app/app-utils.js`
  - Shared helpers (IPFS URL resolve, face fill helpers, texture sizing).
- `app/_client/src/app/app-scene.js`
  - Lighting setup for the WEBGL scene.
- `app/_client/src/app/app-backdrop.js`
  - Background loader, gradient fallback, layered 3D backdrop, foreground overlay.
- `app/_client/src/app/app-cube.js`
  - Cube faces and glass shell rendering.
- `app/_client/src/app/app-edges.js`
  - Wobbly ink edge generation and rendering.
- `app/_client/src/app/app-interaction.js`
  - Mouse/touch rotation and zoom handlers.
- `app/_client/src/app/app-lifecycle.js`
  - p5 lifecycle callbacks (`preload`, `setup`, `draw`) plus event wiring.
- `app/_client/src/app/app-exporter.js`
  - Standalone HTML export, asset embedding, background data URL fetch.
- `app/_client/src/ui/ui-root.js`
  - UI entry point (panels + HUDs).
- `app/_client/src/ui/panels/overlay.js`
  - First-run overlay behavior.
- `app/_client/src/ui/panels/local-textures.js`
  - Local image picker for manual cube textures.
- `app/_client/src/ui/panels/export-ui.js`
  - Export HTML button wiring.
- `app/_client/src/ui/panels/leaderboard.js`
  - Leaderboard panel (ΔLESS ranking).
- `app/_client/src/ui/panels/preview.js`
  - Mobile preview mode toggle.
- `app/_client/src/ui/hud/eth-hud.js`
  - Bottom-right ΔLESS HUD display.
- `app/_client/src/ui/hud/less-hud.js`
  - Bottom-left $LESS supply HUD display.
- `app/_client/src/ui/hud/less-delta.js`
  - Wallet-driven ΔLESS tracking for the HUD.
- `app/_client/src/features/wallet/wallet.js`
  - Wallet connection state + provider handshake.
- `app/_client/src/features/wallet/wallet-ui.js`
  - Wallet connect/disconnect UI binding.
- `app/_client/src/features/nft/picker-ui.js`
  - NFT selection UI + cube texture application.
- `app/_client/src/features/mint/mint-ui.js`
  - Mint flow, floor snapshot UI, and diagnostics.
- `app/_client/src/features/mint/mint-metadata.js`
  - Mint metadata + provenance shaping.
- `app/_client/src/features/mint/token-uri-provider.js`
  - Token URI pinning helper.
- `app/_client/src/data/chain/alchemy-client.ts`
  - Alchemy NFT API wrapper (mainnet + Sepolia).
- `app/_client/src/data/chain/icecube-reader.js`
  - Reads tokenURI via JSON-RPC (no wallet required).
- `app/_client/src/data/chain/less-supply.js`
  - Mainnet $LESS totalSupply fetcher (Alchemy JSON-RPC).
- `app/_client/src/data/chain/less-delta.js`
  - Onchain ΔLESS fetcher (deltaFromLast/deltaFromMint).
- `app/_client/src/data/nft/indexer.ts`
  - Inventory + provenance fetchers.
- `app/_client/src/data/nft/floor.js`
  - Floor price snapshot helper (mainnet only).
- `app/_client/src/gif/params.js`
  - GIF parameter lookup tables.
- `app/_client/src/gif/variant.js`
  - Deterministic GIF variant selection + IPFS path builder.
- `app/_client/src/routes/token-view.js`
  - `/m/<tokenId>` viewer route for animation_url rendering.
- `app/_client/src/shared/utils/uri.ts`
  - URI normalization and resolution helpers.
- `app/_client/src/types/provenance.ts`
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

## Next.js (App Router)

- `next.config.js`
  - Next.js configuration.
- `app/api/nonce/route.js`
  - Returns a nonce for client auth flows.
- `app/api/pin/metadata/route.js`
  - Pins metadata JSON to Pinata (server-side auth).
- `app/api/nfts/route.js`
  - Alchemy NFT proxy + RPC batch (caching + minimized responses).
- `app/api/identity/route.js`
  - Resolves Farcaster/ENS identity for leaderboard display.
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
