# cubeless v0 — State of Review (2025-12-24)

## Summary

The repo is now aligned on the "cubeless" name, the Farcaster manifest includes both `miniapp` and `frame` blocks, and the mint UI builds metadata with `animation_url`. Frontend code is now under `frontend/` with modular UI/data/features layers. Contract tests pass locally, and the RoyaltySplitter forwards any $LESS received from swaps to the owner. The remaining work is primarily deployment setup (IPFS pinning, manifest assets, and onchain deployment wiring).

## What’s working

- **Frontend**: p5 miniapp loads, NFT picker and mint UI are wired.
- **Provenance**: NFT selection -> provenance bundle -> mint metadata pipeline is in place.
- **Mint UI**: builds metadata JSON (still data URI), includes `animation_url`, and logs dev diagnostics.
- **Contracts**: Foundry tests pass (28 total); mint price is fixed at `0.0017 ETH` and royalties are routed to RoyaltySplitter.
- **Security**: threat model, invariants, static analysis plan, and runbook added under `docs/security/`.
- **Floor snapshot + Leaderboard**: per-NFT floor snapshot (default `0` on Sepolia) + Leaderboard scaffold are live.
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

- `forge test`: pass (28 tests).
- `npm test`: no frontend tests configured (placeholder script only).

## Open items (must finish before v0)

### Manifest + assets
- Add `frontend/public/icon.png`, `frontend/public/image.png`, `frontend/public/splash.png` (or update URLs to hosted assets).
- Re-validate manifest on Farcaster after deploy.

### Storage / tokenURI
- Pin p5 build as an IPFS directory.
- Pin metadata JSON to IPFS with `animation_url = ipfs://<appDirCID>/index.html`.
- Update `tokenUriProvider` to return `ipfs://<metaCID>` instead of data URI.
- Add floor snapshot fields to metadata (`collectionFloorEth`, `collectionFloorRetrievedAt`, `sumFloorEth`).

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
- **TokenURI still data URI** → not aligned with IPFS-hosted interactive asset plan.

## Next recommended actions (short list)

1. Add the three manifest images under `frontend/public/` or update the URLs.
2. Confirm Vercel build is using `main` from `cubeless_` and redeploy with cache cleared.
3. Implement IPFS pinning flow and switch `tokenUriProvider`.
4. Deploy Sepolia contract and re-test mint from the miniapp.
