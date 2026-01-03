# cubixles_ v0 — State of Review (2026-01-03)

Last updated: 2026-01-03

## Summary

The repo is aligned on the "cubixles_" name, the Farcaster manifest includes both `miniapp` and `frame` blocks, and the mint UI builds metadata with `image` + `external_url`. Frontend code is modularized (app core, features, data/chain, UI panels + HUDs), with EIP-6963 wallet picking and a WalletConnect fallback. Contracts route mint fees and resale royalties to the RoyaltySplitter (50% ETH to owner + 50% swap to $LESS with a 90% owner / 10% burn split), and $LESS supply snapshots/deltas are stored onchain for leaderboard ranking. The Next.js app router serves the UI, with hardened `/api/*` routes handling Alchemy and Pinata server-side. Coverage gate is enforced at 90% (see `docs/30-SECURITY/SECURITY_AUDIT.md` for latest run).

## What’s working

- **Frontend**: p5 miniapp loads, NFT picker and mint UI are wired; data reads proxy through `/api/nfts` (no client keys), and metadata pinning now requires a signed nonce.
- **Provenance**: NFT selection -> provenance bundle -> mint metadata pipeline is in place.
- **Mint UI**: builds metadata JSON, pins via `/api/pin/metadata`, includes token-specific `external_url` (`/m/<tokenId>`), palette/selection traits, and logs diagnostics; commit step shows a progress indicator while waiting for confirmation.
- **Token viewer**: `/m/<tokenId>` loads tokenURI → provenance refs → cube render; share modal is available on token view pages.
- **Contracts**: Foundry tests cover gating, pricing, and royalty routing; mint price is dynamic from $LESS supply (base `0.0015 ETH`, rounded up to `0.0001 ETH`), tokenId is deterministic via `previewTokenId`, and royalties are routed to RoyaltySplitter which swaps to LESS and forwards to the owner/burn splits. Onchain $LESS supply snapshots + delta views are live.
- **Security**: threat model, invariants, static analysis plan, runbook, and OSPS Baseline mapping in `docs/30-SECURITY/` (coverage gate 90% via `npm run coverage:contracts`).
- **Floor snapshot + Leaderboard**: per-NFT floor snapshot (default `0` when unavailable) + Leaderboard ranking by ΔLESS are live; leaderboard reads through public RPCs on mobile.
- **$LESS metrics**: $LESS supply HUD + ΔLESS HUD and leaderboard ranking by `deltaFromLast` are wired.
- **Server routes**: `/api/nfts`, `/api/pin/metadata`, `/api/nonce`, `/api/identity` are available under Next app router with rate limits, schema validation, and safe logging.
- **Branding**: UI titles, metadata name, and docs are aligned to "cubixles_".

## Current manifest status

- `/.well-known/farcaster.json` includes:
  - `miniapp` + `frame` blocks (identical as required)
  - `version` set to `"1"`
  - Hosted image assets under `/public` (icon, hero, splash, ogImage)
  - `buttonTitle` + `imageUrl` set for share cards
  - `screenshotUrls` includes the primary share image and hero
- accountAssociation set in `public/.well-known/farcaster.json`.
- `miniapp.castShareUrl` set to the Vercel domain.
- The home page includes `fc:frame` and `fc:miniapp` meta tags.

## Deployment status

- Repo: `https://github.com/danyel-ii/cubixles_.git`
- Vercel domain: `https://cubixles-red.vercel.app`
- Risk: Vercel may be serving cached builds or pointing to an older repo/branch (verify source SHA and build output).
- Mainnet contracts (renamed, deployed 2026-01-02):
  - CubixlesMinter: `0x2FCC29B8Db193D8c5F1647Cbf1e5eCC03920D62B`
  - RoyaltySplitter: `0x127AB77A7aB14d2Efb4D58249Ecc373f6e6d8dFF`
  - Deploy txs:
    - RoyaltySplitter CREATE: `0xcf880be2f5adf318f328bd5a9702e2536be8372920e929db30e2bc11b2a49777`
    - CubixlesMinter CREATE: `0xf1f1f1eb160bdc9d79ec2d274b0906235c191984a758246788d74a01055e7f50`
    - Ownership transfer: `0x9cef0a4e1a8eb15f8cc29dfbc3d28cc541b5ab3b0ef07abc5941bd41e0f8f42c`

## Tests

- Latest local/CI results are tracked in `docs/30-SECURITY/SECURITY_AUDIT.md`.

## Open items (must finish before v0)

- Re-validate the Farcaster manifest after each production deploy.
- Run the manual Warpcast E2E mint (at least two selections) before release.

## Risks / blockers

- **Manifest assets missing** → Farcaster validation fails.
- **Vercel cache / wrong repo** → stale deployment behavior.
- **TokenURI pinning depends on server secrets** → ensure `PINATA_JWT` is set in Vercel.

## Next recommended actions (short list)

1. Confirm Vercel build is using `main` from `cubixles_` and redeploy with cache cleared.
2. Re-validate the Farcaster manifest after redeploy.
3. Run `npm run fork-test` before any contract change in production.
