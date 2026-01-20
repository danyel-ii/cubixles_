# Mint Transaction Flow

This primer describes how ETH is routed during minting, including swaps and owner payouts.

## Builder mint flow (CubixlesBuilderMinter)
1. The client requests a signed quote from `/api/builder/quote`.
2. The signer fetches collection floors; any missing or zero floor uses a 0.001 ETH fallback.
3. Mint price is computed as `0.0044 ETH + (sumFloor * 0.07)`.
4. The minter calls `mintBuilders` (or `mintBuildersWithMetadata`) and pays the exact mint price.
5. The contract resolves ERC-2981 royalty receivers for each referenced NFT.
6. Each referenced NFT receives 12% of the total mint price.
7. The remaining mint value is sent to the owner payout address:
   - When set to `OwnerPayoutSplitter`, it swaps 50% of its ETH into PNKSTR and forwards
     both PNKSTR + remaining ETH to the contract owner.
   - If swaps are disabled or fail, all ETH is forwarded to the owner.

## Legacy mint flow (CubixlesMinter)
- Mint proceeds are routed to `RoyaltySplitter`.
- With swaps enabled: 25% ETH to owner, 25% swapped to LESS, 50% swapped to PNKSTR.
- With swaps disabled or failing: 100% ETH is forwarded to the owner.

## Worked example (builder)
Assume a builder mint with 3 referenced NFTs and floor data:
- Floors: 0.08 ETH, 0 ETH (missing), 0.12 ETH.
- Fallback applies to the missing floor: 0.001 ETH.
- Total floor sum = 0.08 + 0.001 + 0.12 = 0.201 ETH.
- Mint price = 0.0044 + (0.201 * 0.07) = 0.0044 + 0.01407 = 0.01847 ETH.
- Each referenced NFT receives 12% of 0.01847 = 0.0022164 ETH.
- Total paid to references = 0.0066492 ETH.
- Owner share = 0.01847 - 0.0066492 = 0.0118208 ETH.
- `OwnerPayoutSplitter` swaps half of 0.0118208 (0.0059104 ETH) into PNKSTR and
  forwards the remaining 0.0059104 ETH to the owner.
