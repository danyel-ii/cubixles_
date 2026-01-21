# cubixles_ Overview

cubixles_ is a Next.js miniapp that mints ERC-721 cubes whose faces are linked to NFTs the minter already owns. The project ships two minting tracks:
- Legacy CubixlesMinter (commit-reveal, LESS/linear pricing).
- Builder CubixlesBuilderMinter (quote-based pricing + per-mint royalty forwarder).

## System components
- Frontend: Next.js app router with p5.js rendering and HUD/UI in `app/_client/`.
- Server routes: Alchemy NFT proxy, builder quote signer, Pinata pinning, IPFS gateway proxy, and metadata/image helpers.
- Contracts: see `docs/contracts.md` for onchain design and deployment inputs.

## Key routes
- `/` landing and routing hub.
- `/build` builder mint path.
- `/m/<tokenId>` legacy token viewer.
- `/m2/<tokenId>` builder token viewer.
- `/m2/preview` builder preview grid.

## Data + storage
- Metadata and generated assets are pinned to IPFS via Pinata.
- Onchain state stores token URIs plus hash commitments and mint pricing snapshots.
- Builder metadata includes per-mint paperclip assets and linked NFT metadata snapshots.

## Core flows
- Legacy mint: commit + metadata commit + mint, with deterministic tokenId and palette draw.
- Builder mint: request quote, pin builder assets + metadata, then mint with signed quote and a
  0.0055 ETH base + 5% floor-derived price (0.01 ETH fallback per face) that routes 8.5% per referenced NFT.
