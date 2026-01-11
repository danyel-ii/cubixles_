# cubixles_ v0 — State of Review (2026-01-10)

Last updated: 2026-01-10

## Summary

The repo is aligned on the "cubixles_" name, the Farcaster manifest includes both `miniapp` and `frame` blocks, and the mint UI uses a hash-only commit + blockhash reveal. Frontend code is modularized (app core, features, data/chain, UI panels + HUDs), with EIP-6963 wallet picking and a WalletConnect fallback. Contracts route mint fees and resale royalties to the RoyaltySplitter (25% ETH to owner + 25% swap to $LESS + 50% swap to $PNKSTR), and $LESS supply snapshots/deltas are stored onchain for leaderboard ranking. `tokenURI` is stored per mint (pinned offchain), with the contract committing to the palette set via `paletteImagesCID` + `paletteManifestHash`. The Next.js app router serves the UI, with hardened `/api/*` routes handling Alchemy and optional Pinata server-side, and CSP enforcement + report-only telemetry via middleware. Coverage gate is enforced at 90% and repo secret scans are automated (see `docs/30-SECURITY/SECURITY_AUDIT.md` for latest run).

## What’s working

- **Frontend**: p5 miniapp loads, NFT picker and mint UI are wired; data reads proxy through `/api/nfts` (no client keys). Optional metadata pinning is protected by signed nonces.
- **Provenance**: NFT selection -> provenance bundle pipeline is in place for offchain diagnostics and optional metadata generation.
- **Mint UI**: builds a commitment hash, calls `commitMint`, waits for the reveal block hash, commits metadata hashes, then calls `mint(salt, refs, expectedPaletteIndex, tokenURI, metadataHash, imagePathHash)`; diagnostics include token viewer links.
- **Token viewer**: `/m/<tokenId>` loads tokenURI → palette metadata → cube render; share modal is available on token view pages. Provenance display requires metadata that includes refs.
- **Contracts**: Foundry tests cover gating, pricing, and royalty routing; mint price is dynamic from $LESS supply on mainnet (base `0.0022 ETH`, rounded up to `0.0001 ETH`), while Base uses immutable linear pricing (0.0012 ETH base + 0.000012 ETH per mint). tokenId is deterministic via `previewTokenId`, commit-reveal uses blockhash entropy, and royalties are routed to RoyaltySplitter which swaps to LESS + PNKSTR and forwards ETH to the owner. Onchain $LESS supply snapshots + delta views are live.
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
- Mainnet contracts (redeployed 2026-01-10):
  - CubixlesMinter: `0x5581FeBb14c00bEC1e6C81068CD281EB4e9a9180`
  - RoyaltySplitter: `0xde51FC988DAB8A58b0a491cdFd9f25c95CeB89ba`
  - Deploy txs:
    - RoyaltySplitter CREATE: `0xaa00b5add52c1b71744a4f5ffd4124cf4ff8efbe83eaf237be37410caa75c59f`
    - CubixlesMinter CREATE: `0x6e1d849be44cb473bd134b48650af95f6f738a0afe6dc7e08a9590dc20d1933b`
    - Ownership transfer: `0xde737e7fe5eee8f77f85037785b1a14021edff3397574b57f242c3105a322dca`
- Base contracts (deployed 2026-01-10):
  - CubixlesMinter: `0xc17C3930569f799e644909313dfBed968757Df1D`
  - RoyaltySplitter: `0xAba3835D447982e1037035b945c67A9ECbED2829`
  - Deploy txs:
    - RoyaltySplitter CREATE: `0xd285828be6ac81befec8c975c3b509a489cf70c2e85999f9d49a949dc0749398`
    - CubixlesMinter CREATE: `0x088c9936def0f2bc4afd19d6a1f23aa706483c6b24664353d6c04e360044815d`
    - Ownership transfer: `0xb3cae316dbdaecd8fd3d79773ad8a4c2d716c3d26a0cc4704f566eaa90caa153`

## Tests

- Latest local/CI results are tracked in `docs/30-SECURITY/SECURITY_AUDIT.md`.

## Open items (must finish before v0)

- Re-validate the Farcaster manifest after each production deploy.
- Run the manual Warpcast E2E mint (at least two selections) before release.

## Risks / blockers

- **Manifest assets missing** → Farcaster validation fails.
- **Vercel cache / wrong repo** → stale deployment behavior.
- **Commit window missed** → commit expires and the mint must be re-committed.
- **Palette images CID/manifest hash or tokenURI pinning misconfigured** → token metadata resolves to the wrong assets.

## Next recommended actions (short list)

1. Confirm Vercel build is using `main` from `cubixles_` and redeploy with cache cleared.
2. Re-validate the Farcaster manifest after redeploy.
3. Run `npm run fork-test` before any contract change in production.
