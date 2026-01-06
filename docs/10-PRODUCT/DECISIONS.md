# Decision Log

Last updated: 2026-01-06

## Review Status

- Last reviewed: 2026-01-05
- Review status: Updated
- Owner: danyel-ii

## 2025-12-22 — T5 Spec Shapes

- v0 chain is Ethereum mainnet (`chainId: 1`), with Sepolia used only for rehearsal/testing when needed; Base runs ETH-only with immutable linear pricing (0.0012 ETH base + 0.00036 ETH per mint).
- `tokenId` stored as base-10 string (from `BigInt`) to allow large IDs.
- Mint gating accepts 1 to 6 referenced NFTs.
- `contractAddress` stored in EIP-55 checksum format.
- `tokenUri` + `image` store both `{ original, resolved }`.
- Provenance stores full `sourceMetadata.raw` JSON.

## 2025-12-23 — T13 Storage Decision (v0)

- Token URI was initially emitted as a data URI for fast iteration.
- A `tokenUriProvider` abstraction isolates the encoding step for future IPFS/Arweave.

## 2025-12-23 → 2025-12-24 — Mint Economics + $LESS Metrics

- Mint price is **dynamic**, derived from $LESS totalSupply:
  - base price `0.0015 ETH`
  - factor `1 + (1B - supply) / 1B` (clamped at 1.0 when supply ≥ 1B)
  - rounded up to the nearest `0.0001 ETH`
- Resale royalties are handled via ERC-2981 with receiver = RoyaltySplitter.
- RoyaltySplitter can attempt a $LESS buy, then splits $LESS 90% owner / 10% burn and forwards remaining ETH to owner (50% ETH sent upfront).
- The minter snapshots $LESS supply at mint and on transfer to support ΔLESS metrics.
- Base deployments disable LESS and use immutable linear pricing (0.0012 ETH base + 0.00036 ETH per mint; no off-chain updates).

## 2025-12-24 — Interactive Metadata (p5.js)

- Mint metadata includes `external_url` pointing to the token viewer route (`/m/<tokenId>`).
- `image` is treated as an optional thumbnail, not the primary work.
- Provenance bundle is stored under `provenance` in the tokenURI JSON.

## 2025-12-24 — Deterministic TokenId + Viewer Route

- TokenId is derived from `msg.sender`, `salt`, and `refsHash` for safe pre-mint metadata.
- `previewTokenId` is used client-side to build token-specific `external_url`.
- `external_url` now points to `https://<domain>/m/<tokenId>` (Vercel viewer).
- Metadata includes palette traits and an `image` pointing to the palette image (gateway URL).

## 2025-12-25 — Server-Only Keys + Next.js Migration Start

- Begin migration to Next.js to host `/api/*` routes on Vercel.
- Client no longer uses Alchemy keys directly; `/api/nfts` proxies allowlisted Alchemy + RPC calls.
- Metadata pinning moves server-side via `/api/pin/metadata` using `PINATA_JWT`.
- Nonce endpoint added at `/api/nonce` for `/api/pin/metadata` auth flows.

## 2025-12-25 — Canonical Refs + Onchain Enumeration

- TokenId hashing now uses canonical (sorted) refs to avoid order-based collisions.
- `refsFaces` (face order) and `refsCanonical` (sorted set) are stored in metadata.
- `totalMinted` + `tokenIdByIndex` added for onchain enumeration.

## 2025-12-26 — Storage + Migration Complete

- TokenURI is pinned via `/api/pin/metadata` (Pinata) and stored as `ipfs://<CID>`.
- Next.js App Router migration is complete; browser uses only `/api/*` for secrets.
