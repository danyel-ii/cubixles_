# cubixles_ v0 — State of Review (2026-01-08)

Last updated: 2026-01-08

## Summary

The repo is aligned on the "cubixles_" name, the Farcaster manifest includes both `miniapp` and `frame` blocks, and the mint UI builds metadata with `image` + `external_url`. Frontend code is modularized (app core, features, data/chain, UI panels + HUDs), with EIP-6963 wallet picking and a WalletConnect fallback. Contracts route mint fees and resale royalties to the RoyaltySplitter (50% ETH to owner + 50% swap to $LESS with a 90% owner / 10% burn split), and $LESS supply snapshots/deltas are stored onchain for leaderboard ranking. The Next.js app router serves the UI, with hardened `/api/*` routes handling Alchemy and Pinata server-side, and CSP enforcement + report-only telemetry via middleware. Coverage gate is enforced at 90% and repo secret scans are automated (see `docs/30-SECURITY/SECURITY_AUDIT.md` for latest run).

## What’s working

- **Frontend**: p5 miniapp loads, NFT picker and mint UI are wired; data reads proxy through `/api/nfts` (no client keys), and metadata pinning now requires a signed nonce.
- **Provenance**: NFT selection -> provenance bundle -> mint metadata pipeline is in place.
- **Mint UI**: builds metadata JSON, pins via `/api/pin/metadata`, includes token-specific `external_url` (`/m/<tokenId>`), palette/selection traits, and logs diagnostics; commit step shows a progress indicator while waiting for confirmation.
- **Token viewer**: `/m/<tokenId>` loads tokenURI → provenance refs → cube render; share modal is available on token view pages.
- **Contracts**: Foundry tests cover gating, pricing, and royalty routing; mint price is dynamic from $LESS supply on mainnet (base `0.0015 ETH`, rounded up to `0.0001 ETH`), while Base uses immutable linear pricing (0.0012 ETH base + 0.000036 ETH per mint). tokenId is deterministic via `previewTokenId`, and royalties are routed to RoyaltySplitter which swaps to LESS and forwards to the owner/burn splits. Onchain $LESS supply snapshots + delta views are live.
- **Security**: threat model, invariants, static analysis plan, runbook, and OSPS Baseline mapping in `docs/30-SECURITY/` (coverage gate 90% via `npm run coverage:contracts`).
- **Security tooling**: CSP report endpoint is live, client + repo secret scans run in CI.
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
- accountAssociation set for `https://www.cubixles.xyz` in `public/.well-known/farcaster.json`.
- `miniapp.castShareUrl` set to `https://www.cubixles.xyz`.
- The home page includes `fc:frame` and `fc:miniapp` meta tags.

## Deployment status

- Repo: `https://github.com/danyel-ii/cubixles_.git`
- Vercel domain: `https://www.cubixles.xyz`
- Risk: Vercel may be serving cached builds or pointing to an older repo/branch (verify source SHA and build output).
- Mainnet contracts (redeployed 2026-01-07):
  - CubixlesMinter: `0x61EdB3bff9c758215Bc8C0B2eAcf2a56c638a6f2`
  - RoyaltySplitter: `0x8c80e16c877F68DFBE461ca64e296e6ec3e69077`
  - Deploy txs:
    - RoyaltySplitter CREATE: `0xf2b2459b9b490cbd058bedebcafe36d4196043947076dd831b889ec26f2e802e`
    - CubixlesMinter CREATE: `0x215a73e4466c4b0c449c7faf4fee6929c9108a67cccc046de0acef8816fe2444`
    - Ownership transfer: `0xb61bdf6419b6f063c55a04620e023d81341019d5385f4e2ba32b2510db66efb8`
- Base contracts (deployed 2026-01-07):
  - CubixlesMinter: `0x428032392237cb3BA908a6743994380DCFE7Bb74`
  - RoyaltySplitter: `0xBaFeAa2Bd3ecb0dDe992727C289aDFA227CA12E2`
  - Deploy txs:
    - RoyaltySplitter CREATE: `0xbf5a179ce7e4b11ff65699a5d69eac56d8c4b75fd66d38702faab4a28d31c3aa`
    - CubixlesMinter CREATE: `0x35b4b0ab506b3d4677550abc90343300c560e82ddc57c827b6ff1c7b5ac3d78a`
    - Ownership transfer: `0x13910eec38b3f1620da45228df56eb93383a6c03add5c01488c03e94f7b168db`

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
