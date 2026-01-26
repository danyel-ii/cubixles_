# cubixles_ Security Overview
Last updated: 2026-01-26

This repository mixes onchain minting contracts with a server-assisted mint pipeline. The security model assumes untrusted NFT references, untrusted metadata URLs, and untrusted client inputs.

## Onchain risk model
- External calls are treated as untrusted (ERC-721 `ownerOf`, ERC-2981 `royaltyInfo`, and royalty receivers).
- Builder mints are protected by non-reentrancy guards and explicit payment checks.
- Per-mint royalty forwarders isolate resale payouts and let the minter define their own splits.
- Quote-based pricing is enforced via EIP-712 signatures and chainId validation.

## Offchain risk model
- Pinning endpoints require a signed nonce, are rate limited, and enforce payload size caps
  (e.g. `PIN_METADATA_MAX_BYTES`, default 50 KB).
- Pinning rejects metadata/asset payloads containing scripts, styles, inline event handlers,
  `javascript:` URLs, or wallet logic markers.
- Quote signing is centralized and must be protected like a key management system.
- IPFS and metadata fetches are constrained by allowlists and size limits to reduce SSRF risk.
  - Allowlists can be extended via `TOKEN_METADATA_ALLOWED_HOSTS`, `BUILDER_METADATA_ALLOWED_HOSTS`,
    `METADATA_ALLOWED_HOSTS`, `IPFS_GATEWAY_ALLOWLIST`, and `IMAGE_PROXY_ALLOWED_HOSTS`.

## Key assumptions
- The quote signer and pinning credentials are secure and rotated when needed.
- Referenced NFTs expose reliable ERC-721 ownership; ERC-2981 is optional and falls back to owner payout.
- Offchain metadata and images are pinned to IPFS and are immutable once minted.

## Known constraints
- If a referenced NFT is not ERC-721 or `ownerOf` fails, a builder mint will revert.
- ERC-2981 missing or `royaltyInfo` failures fall back to the owner payout receiver.
- Royalty receiver contracts can reject ETH; those amounts are redirected to the owner payout
  address, and if that transfer fails they accrue to `pendingOwnerBalance`.
- The builder price quote is only as accurate as the floor oracle data used by the signer.

## Dependency advisory note (elliptic)
- Dependabot alerts for `elliptic` were dismissed as not used for signing/auth/transactions.
- The package is transitive via `vite-plugin-node-polyfills` and only applies to legacy/dev polyfills
  for the Three.js landscape build; it is not part of the minting runtime or wallet signing path.
