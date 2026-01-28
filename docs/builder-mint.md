# Builder Mint Guide
Last updated: 2026-01-28

## Purpose
The builder mint is the primary path for new cubixles_ tokens. It composes a cube from 1 to 6
ERC-721 references that the minter already owns, then mints an ERC-721 whose metadata anchors
those references and their floor snapshots.

## Entry points
- `/build` — builder mint UI.
- `/shaolin_deck` — builder deck + token list.
- `/m2/<tokenId>` — builder token viewer.
- `/m2/preview` — builder preview grid.
- `/what-it-do` — toy intro; no minting.

## Onchain components
- `CubixlesBuilderMinter` — quote validation, payment routing, and minting.
- `BuilderRoyaltyForwarder` — per-token ERC-2981 receiver (10% resale).
- `OwnerPayoutSplitter` — optional owner share swapper.

Mainnet deployment (see `contracts/deployments/builder-mainnet.json`):
- Builder minter: `0x35aD1B49C956c0236ADcD2E7051c3C4e78D4FccA`
- Forwarder implementation: `0xF16B3427aDa1a6325005f13223aeb6C0bBF09169`
- Owner payout: `0x0000000000000000000000000000000000000000` (0x0 means direct owner payout)

## Pricing + payouts
- Mint price = `0.0055 ETH + 5% of total floor sum`.
- Each referenced NFT floor is clamped to `0.01 ETH` when missing, zero, or below the clamp.
- Each referenced NFT receives 8.5% of the mint price (ERC-2981 receiver; fallback to owner payout).
- Remaining value routes to the owner payout address.
- Resale royalties are fixed at 10% and paid to the per-token forwarder.

## Builder mint flow (happy path)
1. Connect wallet on `/build` and select 1 to 6 ERC-721 references.
2. Request a signed quote from `POST /api/builder/quote`.
3. Generate builder assets:
   - `POST /api/pin/builder-assets` pins a QR code + builder card (and optional paperclip).
4. Pin metadata:
   - `POST /api/pin/metadata` stores metadata and returns `tokenURI` + `metadataHash`.
5. Submit the mint transaction:
   - `mintBuildersWithMetadata` with refs, quote, and the metadata hash/URI.
6. View the token in `/m2/<tokenId>` or in `/shaolin_deck`.

## Metadata + assets
Builder metadata includes:
- `builder` block (mint price, floor snapshot, QR/paperclip URLs).
- `linked_nfts` + `provenance` (canonicalized references).
- `attributes` for selection count and floor snapshots.

Builder assets:
- QR code linked to the viewer URL.
- Builder card image derived from `public/assets/builder-card-base.png`.
  - Override via `BUILDER_BASE_IMAGE_PATH`.
- Paperclip PNG generated from the wallet-derived seed and palette.
  - See `docs/paperclips.md` for the generation model.

## APIs used
- `POST /api/builder/quote`
- `POST /api/pin/builder-assets`
- `POST /api/pin/metadata`
- `GET /api/builder/tokens`
- `GET /api/nfts` (wallet inventory + metadata)
- `GET /api/ipfs`, `GET /api/image-proxy` (safe fetch helpers)

## Key environment variables
Required for builder mint:
- `ALCHEMY_API_KEY`
- `CUBIXLES_BUILDER_QUOTE_SIGNER_KEY`
- `PINATA_JWT`

Common configuration:
- `BUILDER_QUOTE_TTL_SEC` (default 300s)
- `PIN_METADATA_MAX_BYTES` (default 50 KB)
- `BUILDER_BASE_IMAGE_PATH` (optional card base override)
- `CUBIXLES_ALLOWED_ORIGINS` (origin allowlist for pin/quote)
- `BUILDER_METADATA_ALLOWED_HOSTS`, `IPFS_GATEWAY_ALLOWLIST`, `IMAGE_PROXY_ALLOWED_HOSTS`
- `DISABLE_PINNING`, `DISABLE_MINTING` (maintenance toggles)

## Troubleshooting
- "Mint price mismatch": quote expired or selection changed. Refresh the quote.
- "Ref not owned": verify ownership + correct chain.
- 401 from pinning: nonce expired or signature mismatch. Refresh and re-sign.
