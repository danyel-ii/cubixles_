# cubixles_ Overview
Last updated: 2026-01-28

cubixles_ is a Next.js miniapp that mints ERC-721 cubes whose faces are linked to NFTs the minter
already owns. The builder track is the primary minting path, with the legacy (bootlegger) track
preserved for earlier tokens.

## Documentation map
- `docs/builder-mint.md` — builder flow (primary).
- `docs/bootlegger-mint.md` — legacy flow (commit-reveal).
- `docs/paperclips.md` — paperclip artwork generation.
- `docs/contracts.md` — onchain architecture and deployments.
- `docs/transactions_flow.md` — value routing during mint.
- `docs/royalty_setter.md` + `docs/setting-your-royalty.md` — resale royalty configuration.
- `docs/security.md` + `docs/operations.md` — security model and ops checklist.

## System components
- Frontend: Next.js app router with p5.js rendering + HUD/UI in `app/_client/`.
- Server routes: NFT inventory proxy, builder quote signer, Pinata pinning, and metadata/image helpers.
- Inspecta deck: `app/inspecta_deck/` for the landing + legacy token list.
- Builder deck: `app/shaolin_deck/` for builder flows and token browsing.
- Toy intro: Three.js landscape in `apps/cubixles_scape/`, built into `public/what-it-do/cubixles_scape/`.
- Contracts: see `docs/contracts.md`.

## Key routes
- `/` — legacy mint UI.
- `/build` — builder mint UI.
- `/shaolin_deck` — builder deck + builder tokens.
- `/inspecta_deck` — landing + legacy token list.
- `/m/<tokenId>` — legacy token viewer.
- `/m2/<tokenId>` — builder token viewer.
- `/m2/preview` — builder preview grid.
- `/what-it-do` — toy intro for the landscape (no minting).
- `/world` — direct landscape entry.

## Data + storage
- Metadata and generated assets are pinned to IPFS via Pinata.
- Onchain state stores token URIs plus commit/metadata hashes and mint snapshots.
- Builder metadata includes per-mint asset references (QR, paperclip) and floor snapshots.

## Core flows
- Builder mint: request quote, pin builder assets + metadata, then mint with a signed quote and
  0.0055 ETH + 5% floor-derived price (0.01 ETH floor clamp per face). See `docs/builder-mint.md`.
- Bootlegger mint: commit-reveal, palette draw, and legacy pricing. See `docs/bootlegger-mint.md`.

## Chain notes
- Builder deployments are active on mainnet; Base/Sepolia entries exist as placeholders until
  deployed and wired.
- Legacy deployments are configured for mainnet and Base.
