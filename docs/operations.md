# cubixles_ Operations
Last updated: 2026-01-26

## Governance
- Maintainer: danyel-ii.
- Changes are reviewed via GitHub pull requests and issues.
- Security-impacting changes require explicit review.

## Access + secrets
- Secrets live in Vercel/GitHub Actions or local `.env` files that are git-ignored.
- Only maintainers should access deploy keys, RPC URLs, Pinata credentials, and signing keys.
- Builder quotes require a private key in `CUBIXLES_BUILDER_QUOTE_SIGNER_KEY` and the onchain
  signer address set via `CUBIXLES_BUILDER_QUOTE_SIGNER`.

## Dependencies
- Contracts use OpenZeppelin and Uniswap v4 primitives.
- Frontend uses Next.js + p5.js with ethers.js for wallet interactions.
- Client code never stores private keys or constructs raw transaction blobs; wallet signing stays in the provider.
- Foundry is the Solidity build/test toolchain.

## Build + deploy notes
- Builder mint (`/build`) is the primary flow; legacy minting is retained for historical tokens.
- The `/what-it-do` landscape is a toy intro built from `apps/cubixles_scape/` and does not touch minting.
- `npm run build` runs `apps/cubixles_scape` first and emits a static build into `public/what-it-do/cubixles_scape/` before building the Next.js app.
