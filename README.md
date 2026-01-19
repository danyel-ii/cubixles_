# cubixles_

cubixles_ is a Next.js miniapp for minting ERC-721 cubes whose faces are linked to NFTs the minter already owns. It ships a legacy mint flow and a builder mint flow, each with its own pricing and royalty mechanics.

## Highlights
- Legacy mints use commit-reveal and LESS/linear pricing.
- Builder mints use signed floor quotes and deploy a per-mint royalty forwarder owned by the minter.
- Token viewers live at `/m/<tokenId>` (legacy) and `/m2/<tokenId>` (builder).
- Metadata and generated assets are pinned to IPFS.

## Repository layout
- `app/` — Next.js app router, API routes, and UI.
- `app/_client/` — p5.js rendering and client-side features.
- `contracts/` — Solidity contracts, tests, and deployment scripts.
- `docs/` — core project documentation.

## Documentation
- `docs/overview.md`
- `docs/contracts.md`
- `docs/security.md`
- `docs/operations.md`
- `technical-review.md`

## Support
See `SUPPORT.md` for defect reporting and help channels.

## Security
See `SECURITY.md` for vulnerability reporting guidance.

## License
See `LICENSE`.
