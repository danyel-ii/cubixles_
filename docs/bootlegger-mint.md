# Bootlegger Mint (Legacy) Guide
Last updated: 2026-01-28

## Purpose
The bootlegger (legacy) mint is retained for historical cubixles_ tokens. It uses commit-reveal
and the legacy `CubixlesMinter` contract. New mints should use the builder track unless you are
explicitly minting legacy tokens.

## Entry points
- `/` — legacy mint UI.
- `/inspecta_deck` — landing + legacy token list.
- `/m/<tokenId>` — legacy token viewer.

## Onchain components
- `CubixlesMinter` — legacy ERC-721 with commit-reveal.
- `RoyaltySplitter` — legacy royalty receiver + swapper.

Mainnet deployment (see `contracts/deployments/mainnet.json`):
- Legacy minter: `0xA72EBf7F8d9Bc4ec5aDF1fFcDF32dfeD0b06F64C`
- Royalty splitter: `0x13Ac4b254585A16599f5eE185894A84F85838804`

## Pricing
- Mainnet uses dynamic LESS-based pricing.
- Base uses linear pricing (no LESS).
- Optional fixed pricing can be enabled onchain when configured.

## Commit-reveal flow (simplified)
1. Select 1 to 6 ERC-721 references in the legacy mint UI.
2. The client generates a random salt and computes a commitment hash.
3. Submit `commitMint` onchain.
4. Wait at least 1 block; the commit is valid for roughly 256 blocks.
5. Pin metadata via `POST /api/pin/metadata` (signed nonce).
6. Submit `mintWithMetadata` with the salt, refs, and metadata hash/URI.
7. View the token in `/m/<tokenId>` or `/inspecta_deck`.

## Metadata
Legacy metadata includes:
- palette selection + palette image
- provenance bundle with refs, salt, and floor snapshots
- animation URL for the p5.js cube viewer

## APIs used
- `GET /api/nfts`
- `GET /api/nonce`
- `POST /api/pin/metadata`
- `GET /api/tokens` (legacy token list)
- `GET /api/ipfs`, `GET /api/image-proxy`

## Key environment variables
- `ALCHEMY_API_KEY`
- `PINATA_JWT`
- `NEXT_PUBLIC_MAINNET_RPC_URL`, `NEXT_PUBLIC_BASE_RPC_URL`
- `NEXT_PUBLIC_DEFAULT_CHAIN_ID`
- `PIN_METADATA_MAX_BYTES`
- `CUBIXLES_ALLOWED_ORIGINS`
- `DISABLE_PINNING`, `DISABLE_MINTING`

## Troubleshooting
- "Commit pending": wait one block before retrying the mint.
- "Commit expired": commit again with the same selection.
- "Metadata mismatch": selection changed between commit and mint; redo the commit.
