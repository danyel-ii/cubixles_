# cubeless v0 — State of Review (2025-12-25)

## Summary

The repo is aligned on the "cubeless" name, the Farcaster manifest includes both `miniapp` and `frame` blocks, and the mint UI builds metadata with `animation_url`. Frontend code is modularized (app core, features, data/chain, UI panels + HUDs). Contract tests pass locally, mint pricing is dynamic based on $LESS totalSupply (base `0.0015 ETH`, rounded up to the nearest `0.0001 ETH`), and $LESS supply snapshots/deltas are stored onchain for leaderboard ranking. The Next.js app router now serves the UI, with hardened `/api/*` routes handling Alchemy and Pinata server-side. Coverage is currently below the 90% gate (82.58%).

## What’s working

- **Frontend**: p5 miniapp loads, NFT picker and mint UI are wired; data reads proxy through `/api/nfts` (no client keys).
- **Provenance**: NFT selection -> provenance bundle -> mint metadata pipeline is in place.
- **Mint UI**: builds metadata JSON, pins via `/api/pin/metadata`, includes token-specific `animation_url` (`/m/<tokenId>`), GIF traits, and logs diagnostics.
- **Token viewer**: `/m/<tokenId>` loads tokenURI → provenance refs → cube render.
- **Contracts**: Foundry tests pass (41 total); mint price is dynamic from $LESS supply (base `0.0015 ETH`, rounded up to `0.0001 ETH`), tokenId is deterministic via `previewTokenId`, and royalties are routed to RoyaltySplitter with 50% burn on $LESS proceeds. Onchain $LESS supply snapshots + delta views are live.
- **Security**: threat model, invariants, static analysis plan, and runbook added under `docs/security/` (coverage gate 90% via `npm run coverage:contracts`, currently failing at 82.58%).
- **Floor snapshot + Leaderboard**: per-NFT floor snapshot (default `0` on Sepolia) + Leaderboard ranking by ΔLESS are live.
- **$LESS metrics**: $LESS supply HUD + ΔLESS HUD and leaderboard ranking by `deltaFromLast` are wired.
- **Server routes**: `/api/nfts`, `/api/pin/metadata`, `/api/nonce`, `/api/identity` are available under Next app router.
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

- `forge test`: pass (41 tests).
- `forge test --fork-url "$MAINNET_RPC_URL" --match-path "test/fork/*" -vvv`: pass (2 tests).
- `npm test`: no frontend tests configured (placeholder script only).

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
