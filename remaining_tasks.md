# Remaining Tasks (Owner Actions)

## Review Status

- Last reviewed: 2025-12-24
- Review status: Needs confirmation
- Owner: TBD

This list captures items still needed from you to complete v0.

## C1 — Contracts: Simplified economics + splitter behavior (Verify)

These changes are implemented in code; verify on a Sepolia deployment.

- Mint price fixed at `0.0017 ETH`, paid to `owner()` with refund on overpayment.
- ERC-2981 royalties set to 5% with receiver = `RoyaltySplitter`.
- RoyaltySplitter behavior:
  - If router unset, forwards 100% ETH to owner.
  - If router set and swap succeeds, forwards $LESS tokens to owner and remaining ETH to owner.
  - If swap reverts, forwards 100% ETH to owner without reverting.

## C2 — Frontend: Floor snapshot + Leaderboard scaffold (Verify)

These changes are implemented in code; verify in the UI.

- Per-NFT floor snapshot (ETH) in selection list.
- Total floor snapshot (ETH) above mint button.
- Floor defaults to `0` on Sepolia (chainId `11155111`).
- Leaderboard placeholder view with navigation from main UI.
- (Optional) Floor snapshot fields in metadata provenance.

## T14 — Direct Mint Call (Finish)

- Deploy `IceCubeMinter` to Sepolia and update `contracts/deployments/sepolia.json`.
- Export ABI to `contracts/abi/IceCubeMinter.json` (`node contracts/scripts/export-abi.mjs`).
- Verify the mint call in the UI:
  - Connect wallet on Sepolia
  - Select 1–6 NFTs
  - Mint transaction succeeds
  - Token URI decodes to metadata JSON with `animation_url` + provenance
  - Confirm $Less treasury placeholder address is set before production
  - Confirm RoyaltySplitter forwards $LESS received from swaps to the owner

## M1 — Manifest Finalization

- Confirm `/.well-known/farcaster.json`:
  - `accountAssociation.header`, `payload`, `signature`
  - `miniapp` and `frame` are identical (required by validator)
  - `miniapp.version` is set
  - `iconUrl`, `imageUrl`, `splashImageUrl` are HTTPS and deployed
- Add `frontend/public/icon.png`, `frontend/public/image.png`, `frontend/public/splash.png` (or update URLs to hosted assets).

## T13 — Storage Decision (Metadata)

- Pin the p5 miniapp build artifacts as an IPFS directory.
- Pin the metadata JSON (tokenURI) with `animation_url = ipfs://<appDirCID>/index.html`.
- Decide on a thumbnail capture flow (optional) and update `image`.
- Update `tokenUriProvider` to return the hosted `ipfs://<metaCID>` URL.

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
