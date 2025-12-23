# IceCubeMinter Contract Details

## Executive Summary

IceCubeMinter is an ERC-721 minting contract that gates minting on ownership of 1 to 6 referenced NFTs. It implements a 10% mint-time royalty split (20% creator, 40% $Less treasury, 20% $PNKSTR treasury, 20% pool placeholder) and a 5% resale royalty via ERC-2981, currently paid to a pool treasury address. The on-chain logic is intentionally minimal: it verifies ownership, mints, stores the token URI, and splits ETH; token metadata and provenance are built in the miniapp and passed as a data URI.

## Contract Overview

Contract: `contracts/src/IceCubeMinter.sol`

- Inherits:
  - `ERC721URIStorage` for token URI storage.
  - `ERC2981` for resale royalties.
  - `Ownable` for admin updates.
- Constructor sets:
  - `creator`, `lessTreasury`, `pnkstrTreasury`, `poolTreasury`
  - default resale royalty receiver + bps (default 5% = 500 bps)

## Mint Flow

Function signature:

```
mint(string tokenURI, NftRef[] refs) payable returns (uint256 tokenId)
```

Key steps:

1. **Reference count check**: `refs.length` must be between 1 and 6.
2. **Ownership validation**: each `NftRef` must be owned by `msg.sender` (ERC-721 `ownerOf` gating).
3. **Mint + metadata**: mint new token ID and store `tokenURI`.
4. **Mint royalty split**: if `msg.value > 0`, split by:
   - 20% to `creator`
   - 40% to `lessTreasury`
   - 20% to `pnkstrTreasury`
   - 20% to `poolTreasury` (placeholder for pool logic)

The split is a direct ETH transfer. Token purchases and pool creation are not yet implemented on-chain.

## Royalty Logic

- **Mint-time split**: encoded in `_splitMintRoyalty`.
- **Resale royalty**: `_setDefaultRoyalty(poolTreasury, bps)` uses ERC-2981.
  - Default is 5% bps on deployments unless overridden.
  - `setResaleRoyalty(bps, receiver)` allows owner to update.

## Admin Controls

- `setRoyaltyReceivers(...)` updates the 4 treasury addresses.
- `setResaleRoyalty(bps, receiver)` updates ERC-2981 receiver + rate.

## Tests

File: `contracts/test/IceCubeMinter.t.sol`

- Ownership gating (revert on non-owned refs)
- Mint royalty split values
- Token URI correctness
- Resale royalty output
- Reference count guardrails (0 or >6 reverts)

## Deployment + ABI Export

- Deploy script: `contracts/script/DeployIceCube.s.sol`
  - Reads:
    - `ICECUBE_CREATOR`
    - `ICECUBE_LESS_TREASURY`
    - `ICECUBE_PNKSTR_TREASURY`
    - `ICECUBE_POOL_TREASURY`
    - `ICECUBE_RESALE_BPS` (optional)
  - Writes deployment to `contracts/deployments/sepolia.json`.

- ABI export:
  - Run `node contracts/scripts/export-abi.mjs`.
  - Outputs `contracts/abi/IceCubeMinter.json`.

## Frontend Integration

File: `src/config/contracts.ts` reads deployment + ABI.

Mint UI: `src/mint/mint-ui.js`

- Builds provenance bundle from selected NFTs.
- Creates a JSON metadata object with `image` and `provenance`.
- Encodes metadata as a data URI and calls `mint(tokenURI, refs)` on Sepolia.

## Known Placeholders / TODOs

- On-chain swaps and pool position management are not implemented.
- ERC-2981 receiver currently points to `poolTreasury` as a placeholder.
- Metadata storage is currently data URI; storage decision is still open (T13).
