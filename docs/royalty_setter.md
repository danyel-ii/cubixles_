# Resale Royalty Setter Guide
Last updated: 2026-01-28

This primer explains how resale royalties are handled onchain and who can configure them. Builder
royalties are the primary path; legacy royalties apply to earlier tokens. For mint flow context,
see `docs/builder-mint.md` and `docs/bootlegger-mint.md`.

## Legacy royalties (CubixlesMinter)
- The legacy minter sets a default ERC-2981 royalty receiver and bps.
- By default, royalties route to `RoyaltySplitter` with a 5% rate (500 bps).
- Only the contract owner can change resale royalties:
  - `setRoyaltyReceiver(address)` updates the receiver at the default rate.
  - `setResaleRoyalty(uint96 bps, address receiver)` updates both rate and receiver
    (max 1000 bps / 10%).

### Example: update legacy resale royalties
1. Deploy or pick a new royalty receiver (e.g., a new `RoyaltySplitter`).
2. As the contract owner, call:
   - `setResaleRoyalty(750, 0xNewSplitter...)` to set a 7.5% royalty, or
   - `setRoyaltyReceiver(0xNewSplitter...)` to keep the default 5% rate.
3. Verify by calling `royaltyInfo(tokenId, salePrice)` and confirming the receiver/bps.

## Builder royalties (CubixlesBuilderMinter + BuilderRoyaltyForwarder)
- Each builder mint clones a `BuilderRoyaltyForwarder`.
- The forwarder is set as the ERC-2981 receiver for that token, with a fixed 10% royalty rate.
- Ownership of the forwarder is assigned to the minter wallet.
- Only the forwarder owner can set splits via `setSplits(recipients, bps)`.
- If no splits are configured, 100% accrues to the forwarder owner.
- See `docs/setting-your-royalty.md` for a detailed walkthrough.

### Example: set builder resale splits
1. Look up the forwarder for a token:
   - Call `royaltyForwarderByTokenId(tokenId)` on `CubixlesBuilderMinter`.
2. From the minter wallet (forwarder owner), call `setSplits` on the forwarder:
   - `setSplits([0xAlice..., 0xBob...], [6000, 4000])`.
3. Future secondary sales route royalties to the forwarder, which accrues 60% to Alice
   and 40% to Bob (with any remainder going to the forwarder owner).
4. Recipients can withdraw accrued ETH via `withdrawPending()`.

## Deployment note (mainnet)
- Builder minter: `0x35aD1B49C956c0236ADcD2E7051c3C4e78D4FccA`
- Royalty forwarder implementation: `0xF16B3427aDa1a6325005f13223aeb6C0bBF09169`
