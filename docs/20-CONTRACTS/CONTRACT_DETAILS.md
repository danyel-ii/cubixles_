# cubixles_ Contract Details (CubixlesMinter)

Last updated: 2026-01-12

## Review Status

- Last reviewed: 2026-01-10
- Review status: Updated
- Owner: danyel-ii

## Executive Summary

CubixlesMinter is an ERC-721 minting contract that gates minting on ownership of 1 to 6 referenced NFTs. Minting costs a **dynamic price** derived from $LESS totalSupply (base `0.0022 ETH`, scaled by a 1.0–4.0 factor, then rounded up to the nearest `0.0001 ETH`), sends mint fees to the RoyaltySplitter, and refunds overpayment. Minting uses a hash-only commit + reveal with onchain entropy derived from the blockhash of the reveal block (commit block + delay) salted with the commitment; the reveal step draws a palette index without replacement at metadata commit. Commits are free, and repeated cancellations can trigger a configurable cooldown. Token metadata is **pinned per mint**: `tokenURI` is provided at mint time (pinned offchain), and the contract stores `paletteImagesCID` + `paletteManifestHash` plus per-token `metadataHash` + `imagePathHash` commitments.
Resale royalties are 5% via ERC-2981 and routed to a RoyaltySplitter contract that optionally swaps via the v4 PoolManager; on successful swap, 25% of the ETH is forwarded to the owner, 25% is swapped to $LESS (owner), 50% is swapped to $PNKSTR (owner), and any leftover ETH is forwarded to the owner. If swaps are disabled or the swap fails, all ETH is forwarded to the owner. The contract snapshots $LESS supply at mint and on transfer to enable onchain delta metrics for leaderboard ranking.
An ETH-only mode is supported when `LESS_TOKEN` is set to `0x0` on deployment; in that case mint pricing is either fixed or linear (base + step) depending on `linearPricingEnabled`, and LESS snapshots/deltas remain `0`. Base deployments use immutable linear pricing (0.0012 ETH base + 0.000012 ETH per mint).
Ownership checks are strict: any `ownerOf` revert triggers `RefOwnershipCheckFailed`, and mismatched owners trigger `RefNotOwned`. ETH transfers use `Address.sendValue` and revert on failure, and swap failures emit `SwapFailedFallbackToOwner` before sending all ETH to the owner.

## Contract Overview

Contract: `contracts/src/cubixles/CubixlesMinter.sol`

- Inherits:
- `ERC721` with a stored `tokenURI`.
  - `ERC2981` for resale royalties.
  - `Ownable` for admin updates.
- Constructor sets:
  - `resaleSplitter`
  - default resale royalty receiver + bps (default 5% = 500 bps, max 10%)

## Mint Flow

Function signature:

```solidity
mint(
  bytes32 salt,
  NftRef[] calldata refs,
  uint256 expectedPaletteIndex,
  string calldata tokenURI,
  bytes32 metadataHash,
  bytes32 imagePathHash
) external payable returns (uint256 tokenId)
```

Commit signature (required before mint):

```solidity
commitMint(bytes32 commitment) external
```

Metadata commit signature (required before mint):

```solidity
commitMetadata(bytes32 metadataHash, bytes32 imagePathHash, uint256 expectedPaletteIndex) external
```

Key steps:

0. **Commit required**: `commitMint(commitment)` must be called first (commit must be mined and the reveal block hash must be available; window is 256 blocks after the reveal block).
   - Commitment hash = `keccak256("cubixles_:commit:v1", minter, salt, refsHash)`.
   - Reveal block = `commit.blockNumber + COMMIT_REVEAL_DELAY_BLOCKS`; reveal is valid once `block.number > revealBlock`.
   - Commits are free. Repeated cancellations via `cancelCommit()` can trigger a cooldown (`commitCancelThreshold` + `commitCooldownBlocks`).
1. **Reference count check**: `refs.length` must be between 1 and 6.
2. **Ownership validation**: each `NftRef` must be owned by `msg.sender` (ERC-721 `ownerOf` gating).
3. **Pricing**: `currentMintPrice()` returns the dynamic $LESS price, linear base + step (when `linearPricingEnabled` is on), or fixed ETH pricing when LESS + linear pricing are disabled.
   - `base = 0.0022 ETH`
   - `factor = 1 + (3 * (1B - supply)) / 1B`, clamped at 1.0 when supply ≥ 1B
   - `price = base * factor`
   - `price` is rounded up to the nearest `0.0001 ETH`
   - linear price = `baseMintPriceWei + (baseMintPriceStepWei * totalMinted)` (no rounding)
   - fixed price = `fixedMintPriceWei` when LESS + linear pricing are disabled
4. **Deterministic tokenId**: computed from `msg.sender`, `salt`, and a **canonical** `refsHash` (refs sorted by contract + tokenId).
4.5 **Supply cap**: mint reverts once `totalMinted` reaches 10,000.
5. **Random palette index**: derived from `keccak256(blockhash(revealBlock), commitment)` (random-without-replacement).
6. **Metadata commit**: after the reveal block is available, minter calls `commitMetadata(metadataHash, imagePathHash, expectedPaletteIndex)` to lock hashes and assign the palette index.
   - `metadataHash` is the keccak256 of the canonical metadata JSON.
   - `imagePathHash` is the keccak256 of the palette image path (relative to `paletteImagesCID`).
7. **Mint + metadata**: minter supplies `expectedPaletteIndex` (must match the draw), a pinned `tokenURI`, and the same `metadataHash` + `imagePathHash`.
8. **Mint payout**: transfers `currentMintPrice()` to `resaleSplitter` and refunds any excess from `msg.value`.

Mint price at time of mint is stored as `mintPriceByTokenId(tokenId)` for UI and analytics.
Metadata commitments are stored as `metadataHashByTokenId(tokenId)` and `imagePathHashByTokenId(tokenId)`.

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
- Clients should call `previewTokenId` before committing to build a token-specific `external_url` or offchain metadata.
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
- `setCommitCooldownBlocks(blocks)` updates the cooldown after repeated cancellations.
- `setCommitCancelThreshold(threshold)` updates the cancellation threshold before cooldown applies.
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
    - `CUBIXLES_COMMIT_CANCEL_THRESHOLD` (optional; cancellations before cooldown)
    - `CUBIXLES_COMMIT_COOLDOWN_BLOCKS` (optional; cooldown length in blocks)
    - `CUBIXLES_PALETTE_IMAGES_CID` (required; base CID for palette images)
    - `CUBIXLES_PALETTE_MANIFEST_HASH` (required; keccak256 hash of the manifest JSON)
    - `CUBIXLES_POOL_MANAGER` (optional; required for swaps)
    - `CUBIXLES_LESS_POOL_FEE` (optional; LESS pool fee)
    - `CUBIXLES_LESS_POOL_TICK_SPACING` (required if PoolManager is set)
    - `CUBIXLES_LESS_POOL_HOOKS` (optional; defaults to `0x0000000000000000000000000000000000000000`)
    - Legacy names (`CUBIXLES_POOL_FEE`, `CUBIXLES_POOL_TICK_SPACING`, `CUBIXLES_POOL_HOOKS`) are still accepted for backward compatibility.
    - `CUBIXLES_PNKSTR_TOKEN` (optional; required for swaps)
    - `CUBIXLES_PNKSTR_POOL_FEE` (optional; PNKSTR pool fee)
    - `CUBIXLES_PNKSTR_POOL_TICK_SPACING` (required if PoolManager is set)
    - `CUBIXLES_PNKSTR_POOL_HOOKS` (optional; defaults to `0x0000000000000000000000000000000000000000`)
    - `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS` (optional, max 1000)
    - `CUBIXLES_RESALE_BPS` (optional)
    - `CUBIXLES_CHAIN_ID` (optional; defaults to `block.chainid`)
    - `CUBIXLES_DEPLOYMENT_PATH` (optional; defaults to `contracts/deployments/<chain>.json`)
  - Writes deployment JSON to the chain-specific default path unless `CUBIXLES_DEPLOYMENT_PATH` is set.
  - Timelock: `contracts/script/DeployTimelock.s.sol` transfers minter + splitter ownership to a TimelockController.
    - `CUBIXLES_TIMELOCK_MIN_DELAY` (seconds)
    - `CUBIXLES_TIMELOCK_ADMIN` / `CUBIXLES_TIMELOCK_PROPOSER` / `CUBIXLES_TIMELOCK_EXECUTOR`
    - `CUBIXLES_MINTER_ADDRESS` / `CUBIXLES_SPLITTER_ADDRESS`

- ABI export:
  - Run `node contracts/scripts/export-abi.mjs`.
  - Outputs `contracts/abi/CubixlesMinter.json`.

## Frontend Integration

File: `app/_client/src/config/contracts.ts` reads deployment + ABI.

Mint UI: `app/_client/src/features/mint/mint-ui.js`

- Builds refs hash and commitment for the selected NFTs.
- Calls `commitMint(commitment)` and waits for the reveal block hash to be available.
- Resolves the palette index, pins metadata offchain, and commits hashes via `commitMetadata(metadataHash, imagePathHash, expectedPaletteIndex)`.
- Calls `mint(salt, refs, expectedPaletteIndex, tokenURI, metadataHash, imagePathHash)` after metadata is committed.
- Offchain metadata pinning is required; `tokenURI` + hashes are stored onchain per mint.
- Metadata includes `animation_url` when `NEXT_PUBLIC_ANIMATION_URL` is set (IPFS GIF).

## Royalty Splitter Behavior

- Swaps via the v4 PoolManager when enabled; otherwise forwards ETH to owner.
- Swap failure forwards all ETH to owner.
- Swap success splits: 25% ETH to owner, 25% swapped to $LESS (owner), 50% swapped to $PNKSTR (owner), then forwards remaining ETH to owner.
