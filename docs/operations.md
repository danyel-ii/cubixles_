# cubixles_ Operations
Last updated: 2026-01-22

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
