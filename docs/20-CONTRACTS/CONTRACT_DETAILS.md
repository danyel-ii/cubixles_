# cubixles_ Contract Details (CubixlesMinter)

Last updated: 2026-01-08

## Review Status

- Last reviewed: 2026-01-08
- Review status: Updated
- Owner: danyel-ii

## Executive Summary

CubixlesMinter is an ERC-721 minting contract that gates minting on ownership of 1 to 6 referenced NFTs. Minting costs a **dynamic price** derived from $LESS totalSupply (base `0.0015 ETH`, scaled by a 1.0–2.0 factor, then rounded up to the nearest `0.0001 ETH`), sends mint fees to the RoyaltySplitter, and refunds overpayment. Resale royalties are 5% via ERC-2981 and routed to a RoyaltySplitter contract that optionally swaps half the royalty via the v4 PoolManager; on successful swap, 50% of the ETH is forwarded to the owner, the remaining ETH is swapped to $LESS, 90% of $LESS goes to the owner and 10% to the burn address, and any leftover ETH is forwarded to the owner. If swaps are disabled or the swap fails, all ETH is forwarded to the owner. The contract also snapshots $LESS supply at mint and on transfer to enable onchain delta metrics for leaderboard ranking. The on-chain logic verifies ownership, mints, stores the token URI, and handles the mint payment; token metadata and provenance are built in the cubixles_ miniapp and should be pinned to IPFS with the interactive p5.js app referenced via `external_url`.
An ETH-only mode is supported when `LESS_TOKEN` is set to `0x0` on deployment; in that case mint pricing is either fixed or linear (base + step) depending on `linearPricingEnabled`, and LESS snapshots/deltas remain `0`. Base deployments use immutable linear pricing (0.0012 ETH base + 0.000036 ETH per mint).
Ownership checks are strict: any `ownerOf` revert triggers `RefOwnershipCheckFailed`, and mismatched owners trigger `RefNotOwned`. ETH transfers use `Address.sendValue` and revert on failure, and swap failures emit `SwapFailedFallbackToOwner` before sending all ETH to the owner.

## Contract Overview

Contract: `contracts/src/cubixles/CubixlesMinter.sol`

- Inherits:
  - `ERC721URIStorage` for token URI storage.
  - `ERC2981` for resale royalties.
  - `Ownable` for admin updates.
- Constructor sets:
  - `resaleSplitter`
  - default resale royalty receiver + bps (default 5% = 500 bps, max 10%)

## Mint Flow

Function signature:

```solidity
mint(bytes32 salt, string calldata tokenURI, NftRef[] calldata refs) external payable returns (uint256 tokenId)
```

Key steps:

0. **Commit required**: `commitMint(salt, refsHash)` must be called first (commit must be mined in a prior block; window is 256 blocks).
1. **Reference count check**: `refs.length` must be between 1 and 6.
2. **Ownership validation**: each `NftRef` must be owned by `msg.sender` (ERC-721 `ownerOf` gating).
3. **Pricing**: `currentMintPrice()` returns the dynamic $LESS price, linear base + step (when `linearPricingEnabled` is on), or fixed ETH pricing when LESS + linear pricing are disabled.
   - `base = 0.0015 ETH`
   - `factor = 1 + (1B - supply) / 1B`, clamped at 1.0 when supply ≥ 1B
   - `price = base * factor`
   - `price` is rounded up to the nearest `0.0001 ETH`
   - linear price = `baseMintPriceWei + (baseMintPriceStepWei * totalMinted)` (no rounding)
   - fixed price = `fixedMintPriceWei` when LESS + linear pricing are disabled
4. **Deterministic tokenId**: computed from `msg.sender`, `salt`, and a **canonical** `refsHash` (refs sorted by contract + tokenId).
4.5 **Supply cap**: mint reverts once `totalMinted` reaches 32,768.
5. **Random palette index**: derived from commit blockhash + `refsHash` + `salt` + minter.
6. **Mint + metadata**: mint token and store `tokenURI`.
7. **Mint payout**: transfers `currentMintPrice()` to `resaleSplitter` and refunds any excess to `msg.sender`.

Mint price at time of mint is stored as `mintPriceByTokenId(tokenId)` for UI and analytics.

Mint payment uses a direct ETH transfer to the RoyaltySplitter. If the payout transfer fails, the mint reverts. Overpayment is always refunded.

## $LESS Supply Snapshots + Deltas

- `mintSupplySnapshot(tokenId)` stores the $LESS totalSupply at mint.
- `lastSupplySnapshot(tokenId)` updates on every non-mint transfer (sales and gifts are treated the same).
- `lessSupplyNow()` exposes the current totalSupply (onchain supply as reported by the token).
- `deltaFromMint(tokenId)` and `deltaFromLast(tokenId)` return snapshot minus current supply (clamped to 0).

These values power the in-app ΔLESS HUD and the leaderboard ranking (canonical metric: `deltaFromLast`). When LESS is disabled, snapshots remain `0` and the Base UI hides the delta metrics.

Note: the UI “$LESS supply” HUD displays remaining supply as `totalSupply - balanceOf(BURN_ADDRESS)` via the server RPC proxy, which can differ from onchain `totalSupply` if burns do not reduce totalSupply.

## Deterministic TokenId Preview

- `previewTokenId(bytes32 salt, NftRef[] refs)` returns the exact tokenId the mint will use.
- Clients should call `previewTokenId` before pinning metadata to build a token-specific `external_url`.
- `totalMinted` and `tokenIdByIndex(index)` provide onchain enumeration for the leaderboard.

## Royalty Logic

Royalty splitter: `contracts/src/royalties/RoyaltySplitter.sol`

- **Mint-time payout**: dynamic mint price to `resaleSplitter` (RoyaltySplitter).
- **Resale royalty**: `_setDefaultRoyalty(resaleSplitter, bps)` uses ERC-2981.
  - Default is 5% bps on deployments unless overridden.
  - `setResaleRoyalty(bps, receiver)` allows owner to update (bps capped at 10%).

## Admin Controls

- `setRoyaltyReceiver(resaleSplitter)` updates ERC-2981 receiver and resets bps to 5%.
- `setResaleRoyalty(bps, receiver)` updates ERC-2981 receiver + rate (bps capped at 10%).
- `setFixedMintPrice(price)` updates fixed pricing when LESS + linear pricing are disabled.
- Mint uses a `nonReentrant` guard to protect the payable transfers.

## Tests

File: `contracts/test/CubixlesMinter.t.sol`

- Ownership gating (revert on non-owned refs)
- Mint payout to owner + refund
- Token URI correctness
- Resale royalty output
- Reference count guardrails (0 or >6 reverts)

## Deployment + ABI Export

- Deploy script: `contracts/script/DeployCubixles.s.sol`
  - Env vars (names use `CUBIXLES_*` for deploy tooling compatibility):
    - `CUBIXLES_OWNER`
    - `CUBIXLES_LESS_TOKEN` (optional; use `0x0` to disable LESS pricing)
    - `CUBIXLES_LINEAR_PRICING_ENABLED` (optional; required for Base linear pricing)
    - `CUBIXLES_BASE_MINT_PRICE_WEI` (optional; base price for linear pricing)
    - `CUBIXLES_BASE_MINT_PRICE_STEP_WEI` (optional; step price for linear pricing)
    - `CUBIXLES_FIXED_MINT_PRICE_WEI` (required when LESS + linear pricing are disabled)
    - `CUBIXLES_BURN_ADDRESS` (optional; defaults to `0x000000000000000000000000000000000000dEaD`)
    - `CUBIXLES_POOL_MANAGER` (optional)
    - `CUBIXLES_POOL_FEE` (optional)
    - `CUBIXLES_POOL_TICK_SPACING` (optional)
    - `CUBIXLES_POOL_HOOKS` (optional)
    - `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS` (optional, max 1000)
    - `CUBIXLES_RESALE_BPS` (optional)
    - `CUBIXLES_CHAIN_ID` (optional; defaults to `block.chainid`)
    - `CUBIXLES_DEPLOYMENT_PATH` (optional; defaults to `contracts/deployments/<chain>.json`)
  - Writes deployment JSON to the chain-specific default path unless `CUBIXLES_DEPLOYMENT_PATH` is set.

- ABI export:
  - Run `node contracts/scripts/export-abi.mjs`.
  - Outputs `contracts/abi/CubixlesMinter.json`.

## Frontend Integration

File: `app/_client/src/config/contracts.ts` reads deployment + ABI.

Mint UI: `app/_client/src/features/mint/mint-ui.js`

- Builds provenance bundle from selected NFTs.
- Creates a JSON metadata object with `image` (palette image via gateway), `image_ipfs` (ipfs:// for wallets), `external_url` (`/m/<tokenId>`), `tokenId`/`chainId`/`salt`, and `provenance.refsFaces` + `provenance.refsCanonical` (pinning may append `preview_gif`).
- Pins metadata via `/api/pin/metadata` and calls `mint(salt, tokenURI, refs)` on mainnet with the resulting `ipfs://` URI.

## Known Placeholders / TODOs

- On-chain pool position management is not implemented.
- RoyaltySplitter swaps via the v4 PoolManager when enabled; otherwise it forwards ETH to owner.
- When the swap fails, all ETH is forwarded to owner.
- When the swap succeeds, 50% of ETH is sent to owner, the rest is swapped to $LESS, then 90% $LESS goes to owner and 10% to burn address, followed by forwarding any remaining ETH balance to owner.
- If PoolManager is unset, swaps are disabled and all ETH is forwarded.
- Metadata is pinned to IPFS via the server route and references the token viewer via `external_url`.
