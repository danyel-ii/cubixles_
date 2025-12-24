# cubeless Contract Details (IceCubeMinter)

## Review Status

- Last reviewed: 2025-12-24
- Review status: Needs confirmation
- Owner: TBD

## Executive Summary

IceCubeMinter is an ERC-721 minting contract that gates minting on ownership of 1 to 6 referenced NFTs. Minting costs 0.0017 ETH and pays the contract owner directly, with refunds for overpayment. Resale royalties are 5% via ERC-2981 and routed to a RoyaltySplitter contract that optionally calls a router with half the royalty; on successful swap, any $LESS tokens are forwarded to the owner and remaining ETH is forwarded to the owner, and if the router is unset or the call fails, all ETH is forwarded to the owner. The on-chain logic verifies ownership, mints, stores the token URI, and handles the mint payment; token metadata and provenance are built in the cubeless miniapp and should be pinned to IPFS with the interactive p5.js app referenced via `animation_url`.

## Contract Overview

Contract: `contracts/src/icecube/IceCubeMinter.sol`

- Inherits:
  - `ERC721URIStorage` for token URI storage.
  - `ERC2981` for resale royalties.
  - `Ownable` for admin updates.
- Constructor sets:
  - `resaleSplitter`
  - default resale royalty receiver + bps (default 5% = 500 bps, max 10%)

## Mint Flow

Function signature:

```
mint(string tokenURI, NftRef[] refs) payable returns (uint256 tokenId)
```

Key steps:

1. **Reference count check**: `refs.length` must be between 1 and 6.
2. **Ownership validation**: each `NftRef` must be owned by `msg.sender` (ERC-721 `ownerOf` gating).
3. **Pricing**: requires `0.0017 ETH` (fixed mint price).
4. **Mint + metadata**: mint new token ID and store `tokenURI`.
5. **Mint payout**: transfers `0.0017 ETH` to `owner()` and refunds any excess to `msg.sender`.

Mint payment uses a direct ETH transfer. If the owner transfer fails, the mint reverts. Overpayment is always refunded.

## Royalty Logic

Royalty splitter: `contracts/src/royalties/RoyaltySplitter.sol`

- **Mint-time payout**: fixed mint price to `owner()`.
- **Resale royalty**: `_setDefaultRoyalty(resaleSplitter, bps)` uses ERC-2981.
  - Default is 5% bps on deployments unless overridden.
  - `setResaleRoyalty(bps, receiver)` allows owner to update (bps capped at 10%).

## Admin Controls

- `setRoyaltyReceiver(resaleSplitter)` updates ERC-2981 receiver and resets bps to 5%.
- `setResaleRoyalty(bps, receiver)` updates ERC-2981 receiver + rate (bps capped at 10%).
- Mint uses a `nonReentrant` guard to protect the payable transfers.

## Tests

File: `contracts/test/IceCubeMinter.t.sol`

- Ownership gating (revert on non-owned refs)
- Mint payout to owner + refund
- Token URI correctness
- Resale royalty output
- Reference count guardrails (0 or >6 reverts)

## Deployment + ABI Export

- Deploy script: `contracts/script/DeployIceCube.s.sol`
  - Reads:
    - `ICECUBE_OWNER`
    - `ICECUBE_LESS_TOKEN` (optional; defaults to mainnet $LESS address)
    - `ICECUBE_ROUTER` (optional)
    - `ICECUBE_SWAP_CALLDATA` (optional)
    - `ICECUBE_RESALE_BPS` (optional)
  - Writes deployment to `contracts/deployments/sepolia.json`.

- ABI export:
  - Run `node contracts/scripts/export-abi.mjs`.
  - Outputs `contracts/abi/IceCubeMinter.json`.

## Frontend Integration

File: `frontend/src/config/contracts.ts` reads deployment + ABI.

Mint UI: `frontend/src/features/mint/mint-ui.js`

- Builds provenance bundle from selected NFTs.
- Creates a JSON metadata object with `image`, `animation_url`, and `provenance`.
- Encodes metadata as a data URI for now and calls `mint(tokenURI, refs)` on Sepolia.
- The intended production flow is to pin the metadata JSON to IPFS and pass `ipfs://<metaCID>` as `tokenURI`.

## Known Placeholders / TODOs

- On-chain swaps and pool position management are not implemented.
- RoyaltySplitter uses a router call if configured; otherwise it forwards ETH to owner.
- When the router call fails, all ETH is forwarded to owner.
- When the router call succeeds, any $LESS received is transferred to owner, then any remaining ETH balance is forwarded to owner.
- Metadata storage is currently a data URI; production should pin metadata to IPFS and reference the p5 app via `animation_url`.
