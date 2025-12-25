# cubeless Contract Details (IceCubeMinter)

## Review Status

- Last reviewed: 2025-12-24
- Review status: Needs confirmation
- Owner: TBD

## Executive Summary

IceCubeMinter is an ERC-721 minting contract that gates minting on ownership of 1 to 6 referenced NFTs. Minting costs a **dynamic price** derived from $LESS totalSupply (base `0.0015 ETH`, scaled by a 1.0–2.0 factor, then rounded up to the nearest `0.0001 ETH`), pays the contract owner directly, and refunds overpayment. Resale royalties are 5% via ERC-2981 and routed to a RoyaltySplitter contract that optionally calls a router with half the royalty; on successful swap, any $LESS tokens are split 50/50 between the burn address and the owner, and remaining ETH is forwarded to the owner, and if the router is unset or the call fails, all ETH is forwarded to the owner. The contract also snapshots $LESS supply at mint and on transfer to enable onchain delta metrics for leaderboard ranking. The on-chain logic verifies ownership, mints, stores the token URI, and handles the mint payment; token metadata and provenance are built in the cubeless miniapp and should be pinned to IPFS with the interactive p5.js app referenced via `animation_url`.

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
mint(bytes32 salt, string tokenURI, NftRef[] refs) payable returns (uint256 tokenId)
```

Key steps:

1. **Reference count check**: `refs.length` must be between 1 and 6.
2. **Ownership validation**: each `NftRef` must be owned by `msg.sender` (ERC-721 `ownerOf` gating).
3. **Pricing**: requires `currentMintPrice()` (dynamic price based on $LESS totalSupply).
   - `base = 0.0015 ETH`
   - `factor = 1 + (1B - supply) / 1B`, clamped at 1.0 when supply ≥ 1B
   - `price = base * factor`
   - `price` is rounded up to the nearest `0.0001 ETH`
4. **Deterministic tokenId**: computed from `msg.sender`, `salt`, and a **canonical** `refsHash` (refs sorted by contract + tokenId).
5. **Mint + metadata**: mint token and store `tokenURI`.
6. **Mint payout**: transfers `currentMintPrice()` to `owner()` and refunds any excess to `msg.sender`.

Mint payment uses a direct ETH transfer. If the owner transfer fails, the mint reverts. Overpayment is always refunded.

## $LESS Supply Snapshots + Deltas

- `mintSupplySnapshot(tokenId)` stores the $LESS totalSupply at mint.
- `lastSupplySnapshot(tokenId)` updates on every non-mint transfer (sales and gifts are treated the same).
- `lessSupplyNow()` exposes the current totalSupply (treated as remaining supply, including burns).
- `deltaFromMint(tokenId)` and `deltaFromLast(tokenId)` return snapshot minus current supply (clamped to 0).

These values power the in-app ΔLESS HUD and the leaderboard ranking (canonical metric: `deltaFromLast`).

## Deterministic TokenId Preview

- `previewTokenId(bytes32 salt, NftRef[] refs)` returns the exact tokenId the mint will use.
- Clients should call `previewTokenId` before pinning metadata to build a token-specific `animation_url`.
- `totalMinted` and `tokenIdByIndex(index)` provide onchain enumeration for the leaderboard.

## Royalty Logic

Royalty splitter: `contracts/src/royalties/RoyaltySplitter.sol`

- **Mint-time payout**: dynamic mint price to `owner()`.
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

File: `app/_client/src/config/contracts.ts` reads deployment + ABI.

Mint UI: `app/_client/src/features/mint/mint-ui.js`

- Builds provenance bundle from selected NFTs.
- Creates a JSON metadata object with `image` (GIF), `animation_url` (`/m/<tokenId>`), `gif` traits, and `provenance.refsFaces` + `provenance.refsCanonical`.
- Pins metadata via `/api/pin/metadata` and calls `mint(salt, tokenURI, refs)` on Sepolia with the resulting `ipfs://` URI.

## Known Placeholders / TODOs

- On-chain swaps and pool position management are not implemented.
- RoyaltySplitter uses a router call if configured; otherwise it forwards ETH to owner.
- When the router call fails, all ETH is forwarded to owner.
- When the router call succeeds, any $LESS received is split 50% to burn address and 50% to owner, then any remaining ETH balance is forwarded to owner.
- Metadata is pinned to IPFS via the server route and references the token viewer via `animation_url`.
