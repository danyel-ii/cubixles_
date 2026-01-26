# cubixles_ Overview
Last updated: 2026-01-26

cubixles_ is a Next.js miniapp that mints ERC-721 cubes whose faces are linked to NFTs the minter already owns. The builder track is the primary minting path, with the legacy track preserved for earlier tokens:
- Builder CubixlesBuilderMinter (quote-based pricing + per-mint royalty forwarder).
- Legacy CubixlesMinter (commit-reveal, LESS/linear pricing).

## System components
- Frontend: Next.js app router with p5.js rendering and HUD/UI in `app/_client/`.
- Server routes: Alchemy NFT proxy, builder quote signer, Pinata pinning, IPFS gateway proxy, and metadata/image helpers.
- Toy intro: the Three.js landscape lives in `apps/cubixles_scape/` and is built into `public/what-it-do/cubixles_scape/`.
- Contracts: see `docs/contracts.md` for onchain design and deployment inputs.

## Key routes
- `/` main mint UI (legacy) + navigation.
- `/build` builder mint UI (primary).
- `/m/<tokenId>` legacy token viewer.
- `/m2/<tokenId>` builder token viewer.
- `/m2/preview` builder preview grid.
- `/what-it-do` toy intro for the landscape (no minting).

## Data + storage
- Metadata and generated assets are pinned to IPFS via Pinata.
- Onchain state stores token URIs plus hash commitments and mint pricing snapshots.
- Builder metadata includes per-mint paperclip assets and linked NFT metadata snapshots.

## Core flows
- Builder mint: request quote, pin builder assets + metadata, then mint with a signed quote and a
  0.0055 ETH base + 5% floor-derived price (0.01 ETH floor clamp per face) that routes 8.5% per
  referenced NFT royalty receiver (fallback to owner payout if ERC-2981 is missing or fails) and
  sets a per-token resale royalty forwarder (10% ERC-2981) owned by the minter.
- Legacy mint: commit + metadata commit + mint, with deterministic tokenId and palette draw.

## Chain notes
- Builder deployments are currently configured on mainnet; Base/Sepolia entries exist as placeholders
  until deployed and wired.
