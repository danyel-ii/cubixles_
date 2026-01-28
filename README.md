# cubixles_
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/danyel-ii/cubixles_)
Last updated: 2026-01-28

cubixles_ is a Next.js miniapp for minting ERC-721 cubes whose faces are linked to NFTs the minter
already owns. The builder mint flow is the primary path; the legacy (bootlegger) flow remains for
earlier tokens and historical compatibility.

## Highlights
- Builder mints use signed floor quotes (0.0055 ETH + 5% of floor totals, 0.01 ETH floor clamp),
  pay 8.5% of the mint price to each referenced NFT royalty receiver, and deploy a per-mint
  royalty forwarder owned by the minter.
- Legacy mints use commit-reveal and LESS/linear pricing.
- Builder mint UI lives at `/build`; the builder deck lives at `/shaolin_deck`.
- Legacy mint UI lives at `/`; legacy token viewers live at `/m/<tokenId>`.
- Builder token viewers live at `/m2/<tokenId>`; builder preview grid lives at `/m2/preview`.
- `/inspecta_deck` is the landing + legacy token list.
- `/what-it-do` is a toy intro that drops into the Three.js landscape; it does not touch minting.

## Repository layout
- `app/` — Next.js app router, API routes, and UI.
- `app/_client/` — p5.js rendering and client-side features.
- `apps/cubixles_scape/` — Three.js landscape (Vite). Builds into `public/what-it-do/cubixles_scape/`.
- `contracts/` — Solidity contracts, tests, and deployment scripts.
- `docs/` — core project documentation.

## Documentation
- [docs/overview.md](docs/overview.md)
- [docs/builder-mint.md](docs/builder-mint.md)
- [docs/bootlegger-mint.md](docs/bootlegger-mint.md)
- [docs/paperclips.md](docs/paperclips.md)
- [docs/contracts.md](docs/contracts.md)
- [docs/security.md](docs/security.md)
- [docs/operations.md](docs/operations.md)
- [docs/transactions_flow.md](docs/transactions_flow.md)
- [docs/royalty_setter.md](docs/royalty_setter.md)
- [Setting Your Builder Royalty Forwarder](docs/setting-your-royalty.md)

## References
- https://github.com/brunosimon/folio-2025

## Support
See `SUPPORT.md` for defect reporting and help channels.

## Security
See `SECURITY.md` for vulnerability reporting guidance.

## License
See `LICENSE`.
