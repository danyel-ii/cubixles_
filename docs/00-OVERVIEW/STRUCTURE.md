# cubixles_ Code Structure

Last updated: 2026-01-08

## Review Status

- Review status: Updated
- Owner: danyel-ii

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
- `app/m/[tokenId]/opengraph-image.jsx`
  - OG preview image renderer for token share cards.
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
- `app/_client/src/ui/hud/base-mint-hud.js`
  - Base token-view mint price HUD (Base only).
- `app/_client/src/features/wallet/wallet.js`
  - Wallet connection state + provider handshake.
- `app/_client/src/features/wallet/wallet-ui.js`
  - Wallet connect/disconnect UI binding + EIP-6963 wallet picker.
- `app/_client/src/features/network/network-ui.js`
  - Network selection UI + persisted chain preference.
- `app/_client/src/features/nft/picker-ui.js`
  - NFT selection UI + cube texture application.
- `app/_client/src/features/mint/mint-ui.js`
  - Mint flow, floor snapshot UI (Alchemy-backed; mainnet + Base), and diagnostics.
- `app/_client/src/features/mint/mint-metadata.js`
  - Offchain metadata + provenance shaping (optional; not part of onchain tokenURI).
- `app/_client/src/features/mint/refs.js`
  - Canonical ref sorting + refsHash helper for commit-reveal.
- `app/_client/src/features/mint/token-uri-provider.js`
  - Token URI pinning helper (legacy/optional in VRF flow).
- `app/_client/src/data/chain/alchemy-client.ts`
  - Alchemy NFT API wrapper via `/api/nfts` (mainnet + Base; optional Sepolia via env).
- `app/_client/src/data/chain/nfts-api.js`
  - Shared `/api/nfts` POST helper for client RPC + Alchemy calls.
- `app/_client/src/data/chain/cubixles-reader.js`
  - Reads tokenURI + mintPriceByTokenId via `/api/nfts` JSON-RPC (no wallet required).
- `app/_client/src/data/chain/less-supply.js`
  - Mainnet $LESS remaining supply fetcher via `/api/nfts` (totalSupply minus burn address).
- `app/_client/src/data/chain/less-delta.js`
  - Onchain ΔLESS fetcher (deltaFromLast/deltaFromMint; mainnet only).
- `app/_client/src/data/nft/indexer.ts`
  - Inventory + provenance fetchers.
- `app/_client/src/data/nft/floor.js`
  - Floor price snapshot helper (Alchemy-backed; mainnet + Base).
- `app/_client/src/gif/params.js`
  - GIF parameter lookup tables.
- `app/_client/src/gif/variant.js`
  - Deterministic GIF variant selection + IPFS path builder.
- `app/_client/src/routes/token-view.js`
  - `/m/<tokenId>` viewer route for external_url rendering and mint price snapshots.
- `app/_client/src/shared/utils/uri.ts`
  - URI normalization and resolution helpers.
- `app/_client/src/types/provenance.ts`
  - Shared NFT/provenance types.

## Contracts Layout

- `contracts/src/cubixles/CubixlesMinter.sol`
  - ERC-721 minting contract with ownership gating + ERC-2981 + VRF commit-reveal.
- `contracts/src/chainlink/VRFConsumerBaseV2.sol`
  - Minimal VRF consumer base for randomness fulfillment.
- `contracts/src/chainlink/VRFCoordinatorV2Interface.sol`
  - Interface for VRF coordinator requests.
- `contracts/src/royalties/RoyaltySplitter.sol`
  - Royalty receiver that can swap for $LESS and forward proceeds (no-swap mode forwards ETH only).
- `contracts/src/mocks/Counter.sol`
  - Foundry sample contract used by tests/scripts.
- `contracts/script/DeployCubixles.s.sol`
  - Deploys RoyaltySplitter + CubixlesMinter and writes deployment JSON (defaults to `contracts/deployments/<chain>.json`, override via `CUBIXLES_DEPLOYMENT_PATH`).
- `contracts/script/DeployTimelock.s.sol`
  - Deploys TimelockController and transfers ownership for minter + splitter.
- `contracts/scripts/export-abi.mjs`
  - Exports CubixlesMinter ABI from the Foundry output directory.
- `contracts/test/*.t.sol`
  - Foundry tests for core contract behavior.
- `contracts/test/fuzz/*.t.sol`
  - Fuzz tests for payment boundaries and ownership gating.
- `contracts/test/invariants/*.t.sol`
  - Invariant tests for mint value conservation and ERC-2981 receiver.
- `contracts/test/fork/*.t.sol`
  - Mainnet fork tests (release gate via `npm run fork-test`).

## Security Docs

- `docs/30-SECURITY/THREAT_MODEL.md`
- `docs/30-SECURITY/INVARIANTS.md`
- `docs/30-SECURITY/KNOWN_LIMITATIONS.md`
- `docs/30-SECURITY/STATIC_ANALYSIS.md`
- `docs/30-SECURITY/SECURITY_AUDIT.md`
- `docs/30-SECURITY/OSPS_BASELINE_2025-10-10.md`

## Governance + Operations Docs

- `docs/40-OPERATIONS/GOVERNANCE.md`
- `docs/40-OPERATIONS/MAINTAINERS.md`
- `docs/40-OPERATIONS/RELEASE.md`
- `docs/40-OPERATIONS/SECRETS_AND_CREDENTIALS.md`
- `docs/40-OPERATIONS/DEPENDENCIES.md`
- `docs/40-OPERATIONS/FOR_PROD.md`

## Root Docs

- `MASTER.md`
  - Top-level entry point linking into the docs tree.
- `docs/00-OVERVIEW/MASTER.md`
  - Master index, glossary, and doc map.
- `README.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `SUPPORT.md`
- `CHANGELOG.md`

## Next.js (App Router)

- `next.config.js`
  - Next.js configuration.
- `app/api/nonce/route.js`
  - Returns a signed nonce for client auth flows.
- `app/api/pin/metadata/route.js`
  - Optional Pinata metadata pinning (server-side auth).
- `app/api/nfts/route.js`
  - Alchemy NFT proxy + RPC batch (caching + minimized responses).
- `app/api/identity/route.js`
  - Resolves Farcaster/ENS identity for leaderboard display.
- `app/api/csp-report/route.js`
  - Receives CSP violation reports (telemetry only).
- `docs/30-SECURITY/SECURITY_RUNBOOK.md`
- `docs/30-SECURITY/FORK_TESTING.md`

## Server Utilities

- `src/server/env.js`
  - Server-only env assertions.
- `src/server/auth.js`
  - Nonce issuance and EIP-191 signature verification.
- `src/server/ratelimit.js`
  - Redis-backed token bucket rate limiter with in-memory fallback.
- `src/server/cache.js`
  - Redis-backed TTL cache helper with LRU in-memory fallback.
- `src/server/redis.js`
  - Upstash Redis client helper.
- `src/server/metrics.js`
  - Lightweight counter metrics (console flush).
- `src/server/pinata.js`
  - Optional Pinata JSON pinning + dedupe.
- `src/server/validate.js`
  - Zod validation + JSON size enforcement.
- `src/server/json.js`
  - Canonical JSON stringifier.
- `src/server/log.js`
  - Safe request logging.
- `src/server/request.js`
  - Client IP detection.

## Scripts

- `scripts/fork-test.sh`
  - Fork test harness (short path for Foundry).
- `scripts/check-client-secrets.mjs`
  - Scans client bundle for forbidden keys.
- `scripts/check-repo-secrets.mjs`
  - Scans repo files for forbidden secrets.

## Shared Schemas

- `src/shared/schemas/metadata.js`
  - Metadata validation + ref extraction.
- `src/shared/ipfs-fetch.js`
  - IPFS gateway fallback helper.

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
- `scripts/fork-test.sh`
  - Release gate wrapper for mainnet fork tests.

## Test Layout

- `tests/unit/*.spec.mjs`
  - Pure logic tests (provenance, GIF mapping, metadata, IPFS normalization).
- `tests/component/*.spec.mjs`
  - DOM/component tests for UI widgets (HUDs, NFT picker).
- `tests/api/*.spec.mjs`
  - Node tests for `/api/*` route handlers with mocks.
- `tests/smoke.spec.mjs`
  - Playwright smoke test for the home UI shell.
- `tests/e2e/*.spec.mjs`
  - Playwright mocked E2E flows (mint + token viewer).
