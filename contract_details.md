# cubeless Contract Details (IceCubeMinter)

## Review Status

- Last reviewed: 2025-12-23
- Review status: Needs confirmation
- Owner: TBD

## Executive Summary

IceCubeMinter is an ERC-721 minting contract that gates minting on ownership of 1 to 6 referenced NFTs. Minting costs 0.0027 ETH plus a 10% royalty. Mint royalties split 20% to the creator, 20% to the $Less treasury (placeholder), and 60% across the referenced NFT contracts (per NFT). Resale royalties are 5% via ERC-2981 and routed to an on-chain splitter. The on-chain logic verifies ownership, mints, stores the token URI, and splits ETH; token metadata and provenance are built in the cubeless miniapp and should be pinned to IPFS with the interactive p5.js app referenced via `animation_url`.

## Contract Overview

Contract: `contracts/src/IceCubeMinter.sol`

- Inherits:
  - `ERC721URIStorage` for token URI storage.
  - `ERC2981` for resale royalties.
  - `Ownable` for admin updates.
- Constructor sets:
  - `creator`, `lessTreasury`, `resaleSplitter`
  - default resale royalty receiver + bps (default 5% = 500 bps)

## Mint Flow

Function signature:

```
mint(string tokenURI, NftRef[] refs) payable returns (uint256 tokenId)
```

Key steps:

1. **Reference count check**: `refs.length` must be between 1 and 6.
2. **Ownership validation**: each `NftRef` must be owned by `msg.sender` (ERC-721 `ownerOf` gating).
3. **Pricing**: requires `0.0027 ETH` plus royalty (10% of mint price).
4. **Mint + metadata**: mint new token ID and store `tokenURI`.
5. **Mint royalty split**: for each referenced NFT, query `royaltyInfo(tokenId, MINT_PRICE)` to find the receiver and split by:
   - 20% to `creator`
   - 20% to `lessTreasury` (placeholder for $Less buy)
   - 60% split per NFT across referenced contracts (equal per NFT)

The split is a direct ETH transfer. Token purchases and pool creation are not yet implemented on-chain.
If any receiver reverts during the split, the mint reverts and no partial transfers occur.
If a referenced NFT contract does not implement ERC-2981, that NFT’s royalty slice is skipped and not charged.
If the sender overpays, the contract refunds the excess after processing the split.

## Royalty Logic

- **Mint-time split**: encoded in `_splitMintRoyalty`.
- **Resale royalty**: `_setDefaultRoyalty(resaleSplitter, bps)` uses ERC-2981.
  - Default is 5% bps on deployments unless overridden.
  - `setResaleRoyalty(bps, receiver)` allows owner to update.

## Admin Controls

- `setRoyaltyReceivers(...)` updates `creator`, `lessTreasury`, and `resaleSplitter`.
- `setResaleRoyalty(bps, receiver)` updates ERC-2981 receiver + rate.
- Mint uses a `nonReentrant` guard to protect the payable split.

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
    - `ICECUBE_RESALE_SPLITTER`
    - `ICECUBE_RESALE_BPS` (optional)
  - Writes deployment to `contracts/deployments/sepolia.json`.

- ABI export:
  - Run `node contracts/scripts/export-abi.mjs`.
  - Outputs `contracts/abi/IceCubeMinter.json`.

## Frontend Integration

File: `src/config/contracts.ts` reads deployment + ABI.

Mint UI: `src/mint/mint-ui.js`

- Builds provenance bundle from selected NFTs.
- Creates a JSON metadata object with `image`, `animation_url`, and `provenance`.
- Encodes metadata as a data URI for now and calls `mint(tokenURI, refs)` on Sepolia.
- The intended production flow is to pin the metadata JSON to IPFS and pass `ipfs://<metaCID>` as `tokenURI`.

## Known Placeholders / TODOs

- On-chain swaps and pool position management are not implemented.
- ERC-2981 receiver currently points to `poolTreasury` as a placeholder.
- Metadata storage is currently a data URI; production should pin metadata to IPFS and reference the p5 app via `animation_url`.
