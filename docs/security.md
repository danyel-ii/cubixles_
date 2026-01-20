# cubixles_ Security Overview

This repository mixes onchain minting contracts with a server-assisted mint pipeline. The security model assumes untrusted NFT references, untrusted metadata URLs, and untrusted client inputs.

## Onchain risk model
- External calls are treated as untrusted (ERC-721 `ownerOf`, ERC-2981 `royaltyInfo`, and royalty receivers).
- Builder mints are protected by non-reentrancy guards and explicit payment checks.
- Per-mint royalty forwarders isolate resale payouts and let the minter define their own splits.
- Quote-based pricing is enforced via EIP-712 signatures and chainId validation.

## Offchain risk model
- Pinning endpoints require a signed nonce and are rate limited.
- Quote signing is centralized and must be protected like a key management system.
- IPFS and metadata fetches are constrained by allowlists and size limits to reduce SSRF risk.
  - Allowlists can be extended via `TOKEN_METADATA_ALLOWED_HOSTS` and `BUILDER_METADATA_ALLOWED_HOSTS`.

## Key assumptions
- The quote signer and pinning credentials are secure and rotated when needed.
- Referenced NFTs expose reliable ERC-721 ownership and ERC-2981 royalty receivers.
- Offchain metadata and images are pinned to IPFS and are immutable once minted.

## Known constraints
- If a referenced NFT or royalty receiver reverts, a builder mint will revert.
- Royalty receiver contracts can reject ETH; those amounts fall back to the builder owner balance
  if the payout address rejects funds.
- The builder price quote is only as accurate as the floor oracle data used by the signer.
