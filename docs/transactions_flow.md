# Mint Transaction Flow
Last updated: 2026-01-28

This primer describes how ETH is routed during minting, including swaps and owner payouts.
The builder flow is the primary minting path; the legacy flow is retained for earlier tokens.
For full UX steps, see `docs/builder-mint.md` and `docs/bootlegger-mint.md`.

## Builder mint flow (CubixlesBuilderMinter)
1. The client requests a signed quote from `/api/builder/quote`.
2. The signer fetches collection floors; any missing, zero, or sub-0.01 floor is clamped to 0.01 ETH.
3. Mint price is computed as `0.0055 ETH + (sumFloor * 0.05)`.
4. The minter calls `mintBuilders` or `mintBuildersWithMetadata` and pays the exact mint price.
5. The contract resolves ERC-2981 royalty receivers for each referenced NFT (falls back to the owner
   payout receiver if ERC-2981 is missing or `royaltyInfo` fails).
6. Each referenced NFT royalty receiver receives 8.5% of the total mint price; any fallback share
   routes to the owner payout receiver.
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
- Clamp applies to the missing floor: 0.01 ETH.
- Total floor sum = 0.08 + 0.01 + 0.12 = 0.21 ETH.
- Mint price = 0.0055 + (0.21 * 0.05) = 0.0055 + 0.0105 = 0.016 ETH.
- Each referenced NFT receives 8.5% of 0.016 = 0.00136 ETH.
- Total paid to references = 0.00408 ETH.
- Owner share = 0.016 - 0.00408 = 0.01192 ETH.
- `OwnerPayoutSplitter` swaps half of 0.01192 (0.00596 ETH) into PNKSTR and
  forwards the remaining 0.00596 ETH to the owner.
