# Remaining Tasks (Owner Actions)

## Review Status

- Last reviewed: 2025-12-25
- Review status: Needs confirmation
- Owner: TBD

This list captures items still needed from you to complete v0.

## C1 — Contracts: Economics + splitter behavior (Verify)

These changes are implemented in code; verify on a Sepolia deployment.

- Mint price is dynamic from $LESS totalSupply (base `0.0015 ETH`, clamped factor, rounded up to `0.0001 ETH`).
- Mint pays `currentMintPrice()` to `owner()` with refund on overpayment.
- ERC-2981 royalties set to 5% with receiver = `RoyaltySplitter`.
- RoyaltySplitter behavior:
  - If router unset, forwards 100% ETH to owner.
  - If router set and swap succeeds, forwards $LESS tokens to owner and remaining ETH to owner.
  - If swap reverts, forwards 100% ETH to owner without reverting.

## C2 — Frontend: Floor snapshot + Leaderboard (Verify)

These changes are implemented in code; verify in the UI.

- Per-NFT floor snapshot (ETH) in selection list.
- Total floor snapshot (ETH) above mint button.
- Floor defaults to `0` on Sepolia (chainId `11155111`).
- Leaderboard ranks tokens by ΔLESS (deltaFromLast) and shows current supply.
- (Optional) Floor snapshot fields in metadata provenance.

## T14 — Direct Mint Call (Finish)

- Deploy `IceCubeMinter` to Sepolia and update `contracts/deployments/sepolia.json`.
- Export ABI to `contracts/abi/IceCubeMinter.json` (`node contracts/scripts/export-abi.mjs`).
- Verify the mint call in the UI:
  - Connect wallet on Sepolia
  - Select 1–6 NFTs
  - Mint transaction succeeds

## T15 — Coverage Gate (Verify)

- Run `npm run coverage:contracts` and review `docs/reports/coverage_report.md` (90% minimum).
- Current coverage is 82.58% (fail); add tests or exclude scripts to reach 90%.

## T16 — Fork Tests (Verify)

- Mainnet fork tests now pass using `MAINNET_RPC_URL`; keep re-running after contract changes.

## T17 — Next.js Migration (In Progress)

- UI now runs under the Next.js app router (`app/`), with client modules under `app/_client/`.
- Server routes live under `app/api/*` (nonce, Pinata pinning, NFT proxy).
- Finish validating the Next build on Vercel (token viewer `/m/<tokenId>`).
- Confirm $LESS token address is set before production
- Confirm RoyaltySplitter forwards $LESS received from swaps to the owner

## M1 — Manifest Finalization

- Confirm `/.well-known/farcaster.json`:
  - `accountAssociation.header`, `payload`, `signature`
  - `miniapp` and `frame` are identical (required by validator)
  - `miniapp.version` is set
  - `iconUrl`, `imageUrl`, `splashImageUrl` are HTTPS and deployed
- Add `public/icon.png`, `public/image.png`, `public/splash.png` (or update URLs to hosted assets).

## T13 — Storage Decision (Metadata)

- Verify metadata pinning works end-to-end (`/api/pin/metadata`).
- Confirm `animation_url = https://<domain>/m/<tokenId>` resolves in the viewer.
- Decide on a thumbnail capture flow (optional) and update `image` if needed.

## Contract Ops

- (Optional) Etherscan verification for Sepolia deployment.
- Confirm treasury addresses:
  - Owner address (receives mint + royalties)
  - $LESS token address (for splitter buy + forwarding)
  - RoyaltySplitter contract
- Confirm deploy script env vars:
  - `ICECUBE_OWNER`
  - `ICECUBE_LESS_TOKEN`
  - `ICECUBE_ROUTER`
  - `ICECUBE_SWAP_CALLDATA`
  - `ICECUBE_RESALE_BPS`
