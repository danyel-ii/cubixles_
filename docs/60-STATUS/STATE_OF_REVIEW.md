# cubeless v0 — State of Review (2025-12-29)

Last updated: 2025-12-29

## Summary

The repo is aligned on the "cubeless" name, the Farcaster manifest includes both `miniapp` and `frame` blocks, and the mint UI builds metadata with `animation_url`. Frontend code is modularized (app core, features, data/chain, UI panels + HUDs). Contract tests pass locally, mint pricing is dynamic based on $LESS totalSupply (base `0.0015 ETH`, rounded up to the nearest `0.0001 ETH`), and $LESS supply snapshots/deltas are stored onchain for leaderboard ranking. The Next.js app router serves the UI, with hardened `/api/*` routes handling Alchemy and Pinata server-side. Coverage now passes the 90% gate (95.02%).

## What’s working

- **Frontend**: p5 miniapp loads, NFT picker and mint UI are wired; data reads proxy through `/api/nfts` (no client keys), and metadata pinning now requires a signed nonce.
- **Provenance**: NFT selection -> provenance bundle -> mint metadata pipeline is in place.
- **Mint UI**: builds metadata JSON, pins via `/api/pin/metadata`, includes token-specific `animation_url` (`/m/<tokenId>`), GIF traits, and logs diagnostics.
- **Token viewer**: `/m/<tokenId>` loads tokenURI → provenance refs → cube render.
- **Contracts**: Foundry tests pass (51 total); mint price is dynamic from $LESS supply (base `0.0015 ETH`, rounded up to `0.0001 ETH`), tokenId is deterministic via `previewTokenId`, and royalties are routed to RoyaltySplitter with 50% burn on $LESS proceeds. Onchain $LESS supply snapshots + delta views are live.
- **Security**: threat model, invariants, static analysis plan, runbook, and OSPS Baseline mapping in `docs/30-SECURITY/` (coverage gate 90% via `npm run coverage:contracts`, currently passing at 90.67%).
- **Floor snapshot + Leaderboard**: per-NFT floor snapshot (default `0` on Sepolia) + Leaderboard ranking by ΔLESS are live.
- **$LESS metrics**: $LESS supply HUD + ΔLESS HUD and leaderboard ranking by `deltaFromLast` are wired.
- **Server routes**: `/api/nfts`, `/api/pin/metadata`, `/api/nonce`, `/api/identity` are available under Next app router with rate limits, schema validation, and safe logging.
- **Branding**: UI titles, metadata name, and docs are aligned to "cubeless".

## Current manifest status

- `/.well-known/farcaster.json` includes:
  - `accountAssociation` (set)
  - `miniapp` + `frame` blocks (identical as required)
  - `version` set to `"1"`
- **Still missing**: hosted image assets referenced by:
  - `https://cubeless-red.vercel.app/icon.png`
  - `https://cubeless-red.vercel.app/image.png`
  - `https://cubeless-red.vercel.app/splash.png`

## Deployment status

- Repo: `https://github.com/danyel-ii/cubeless_.git`
- Vercel domain: `https://cubeless-red.vercel.app`
- Risk: Vercel may be serving cached builds or pointing to an older repo/branch (verify source SHA and build output).

## Tests

- `forge test`: pass (63 tests).
- `npm run fork-test` with `MAINNET_RPC_URL` + `FORK_BLOCK_NUMBER=19000000` (and proxy vars cleared on macOS): pass (2 tests).
- `npm test`: Vitest unit/component/API suite pass (22 tests).
- `npm run test:ui`: Playwright smoke test pass (1 test).
- `npm run check:no-client-secrets`: pass (no forbidden strings in the client bundle).
- `npm audit --json`: 0 vulnerabilities after upgrading Vitest to v4.0.16.

## Open items (must finish before v0)

### Manifest + assets
- Add `public/icon.png`, `public/image.png`, `public/splash.png` (or update URLs to hosted assets).
- Re-validate manifest on Farcaster after deploy.

### Storage / tokenURI
- Pin metadata JSON to IPFS and set `tokenURI = ipfs://<metaCID>`.
- Use `animation_url = https://<domain>/m/<tokenId>` (Vercel token viewer).
- Ensure metadata includes GIF traits + provenance refs.

### Onchain deployment
- Deploy `IceCubeMinter` to Sepolia.
- Export ABI + update `contracts/abi/IceCubeMinter.json`.
- Verify mint call in UI with 1–6 NFTs on Sepolia.
  - Confirm RoyaltySplitter forwards $LESS received from swaps to owner.

### Release gate
- Manual Warpcast E2E mint (at least two selections).

## Risks / blockers

- **Manifest assets missing** → Farcaster validation fails.
- **Vercel cache / wrong repo** → stale deployment behavior.
- **TokenURI pinning depends on server secrets** → ensure `PINATA_JWT` is set in Vercel.

## Next recommended actions (short list)

1. Add the three manifest images under `public/` or update the URLs.
2. Confirm Vercel build is using `main` from `cubeless_` and redeploy with cache cleared.
3. Implement IPFS pinning flow and switch `tokenUriProvider`.
4. Deploy Sepolia contract and re-test mint from the miniapp.
