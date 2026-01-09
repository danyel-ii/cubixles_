# cubixles_ v0 — State of Review (2026-01-09)

Last updated: 2026-01-09

## Summary

The repo is aligned on the "cubixles_" name, the Farcaster manifest includes both `miniapp` and `frame` blocks, and the mint UI uses a hash-only commit + VRF-driven reveal. Frontend code is modularized (app core, features, data/chain, UI panels + HUDs), with EIP-6963 wallet picking and a WalletConnect fallback. Contracts route mint fees and resale royalties to the RoyaltySplitter (50% ETH to owner + 50% swap to $LESS with a 90% owner / 10% burn split), and $LESS supply snapshots/deltas are stored onchain for leaderboard ranking. `tokenURI` is computed onchain from the palette metadata CID (`ipfs://<cid>/<index>.json`). The Next.js app router serves the UI, with hardened `/api/*` routes handling Alchemy and optional Pinata server-side, and CSP enforcement + report-only telemetry via middleware. Coverage gate is enforced at 90% and repo secret scans are automated (see `docs/30-SECURITY/SECURITY_AUDIT.md` for latest run).

## What’s working

- **Frontend**: p5 miniapp loads, NFT picker and mint UI are wired; data reads proxy through `/api/nfts` (no client keys). Optional metadata pinning is protected by signed nonces.
- **Provenance**: NFT selection -> provenance bundle pipeline is in place for offchain diagnostics and optional metadata generation.
- **Mint UI**: builds a commitment hash, calls `commitMint`, waits for VRF fulfillment, then calls `mint(salt, refs)`; diagnostics include token viewer links.
- **Token viewer**: `/m/<tokenId>` loads tokenURI → palette metadata → cube render; share modal is available on token view pages. Provenance display requires metadata that includes refs.
- **Contracts**: Foundry tests cover gating, pricing, and royalty routing; mint price is dynamic from $LESS supply on mainnet (base `0.0022 ETH`, rounded up to `0.0001 ETH`), while Base uses immutable linear pricing (0.0012 ETH base + 0.000012 ETH per mint). tokenId is deterministic via `previewTokenId`, commit-reveal uses VRF, and royalties are routed to RoyaltySplitter which swaps to LESS and forwards to the owner/burn splits. Onchain $LESS supply snapshots + delta views are live.
- **Security**: threat model, invariants, static analysis plan, runbook, and OSPS Baseline mapping in `docs/30-SECURITY/` (coverage gate 90% via `npm run coverage:contracts`).
- **Security tooling**: CSP report endpoint is live, client + repo secret scans run in CI.
- **Floor snapshot + Leaderboard**: per-NFT floor snapshot (default `0` when unavailable) + Leaderboard ranking by ΔLESS are live; leaderboard reads through public RPCs on mobile.
- **$LESS metrics**: $LESS supply HUD + ΔLESS HUD and leaderboard ranking by `deltaFromLast` are wired.
- **Server routes**: `/api/nfts`, `/api/pin/metadata` (optional), `/api/nonce`, `/api/identity` are available under Next app router with rate limits, schema validation, and safe logging.
- **Branding**: UI titles, metadata name, and docs are aligned to "cubixles_".

## Current manifest status

- `/.well-known/farcaster.json` includes:
  - `miniapp` + `frame` blocks (identical as required)
  - `version` set to `"1"`
  - Hosted image assets under `/public/assets` (icon, hero, splash, ogimage)
  - `buttonTitle` + `imageUrl` set for share cards
  - `screenshotUrls` includes the primary share image and hero
- accountAssociation set for `https://www.cubixles.xyz` in `public/.well-known/farcaster.json`.
- `miniapp.castShareUrl` set to `https://www.cubixles.xyz`.
- The home page includes `fc:frame` and `fc:miniapp` meta tags.

## Deployment status

- Repo: `https://github.com/danyel-ii/cubixles_.git`
- Vercel domain: `https://www.cubixles.xyz`
- Risk: Vercel may be serving cached builds or pointing to an older repo/branch (verify source SHA and build output).
- Mainnet contracts (redeployed 2026-01-09):
  - CubixlesMinter: `0x1DF2240b266A54E6b5a8118d0d2214256ADfBBAb`
  - RoyaltySplitter: `0x58594deAe6b192Db91cfD534D6c67e0e371cc876`
  - Deploy txs:
    - RoyaltySplitter CREATE: `0x09e2eb958a6e026dd583b91f81160ffdc4e9a2968dfee3165fa83c2d18e05f42`
    - CubixlesMinter CREATE: `0xf4bae8c43960057fecbaa68b941bb7100b1055c9db61b5107f300cb2dc39c554`
    - Ownership transfer: `0xc83dd7a34f5bf357a0563dd8d51f7b0550589d74be07109f49d55fc03691350b`
- Base contracts (deployed 2026-01-09):
  - CubixlesMinter: `0xFA760797Db195d705F8f52709c447497da377Ebf`
  - RoyaltySplitter: `0xa2F6765466D78fc2CeDeA1b3212f3a909ABc4a30`
  - Deploy txs:
    - RoyaltySplitter CREATE: `0x35332001923615a15c0ab8d97a7b35f99b9b76eeb1f0eb8a5ee4bc6d05a4b56e`
    - CubixlesMinter CREATE: `0xeef5aa7b4886c284d13bdf6f9f3732894bced7628426b9ffe1b6d7573eabbf00`
    - Ownership transfer: `0x04a78820f65da23e482c66bb385d72adac7b7b2604000bcd77fd6a4b4d04a1f5`

## Tests

- Latest local/CI results are tracked in `docs/30-SECURITY/SECURITY_AUDIT.md`.

## Open items (must finish before v0)

- Re-validate the Farcaster manifest after each production deploy.
- Run the manual Warpcast E2E mint (at least two selections) before release.

## Risks / blockers

- **Manifest assets missing** → Farcaster validation fails.
- **Vercel cache / wrong repo** → stale deployment behavior.
- **VRF subscription underfunded or not configured** → commits will stall until randomness fulfills.
- **Palette metadata CID misconfigured** → `tokenURI` will resolve to the wrong metadata set.

## Next recommended actions (short list)

1. Confirm Vercel build is using `main` from `cubixles_` and redeploy with cache cleared.
2. Re-validate the Farcaster manifest after redeploy.
3. Run `npm run fork-test` before any contract change in production.
