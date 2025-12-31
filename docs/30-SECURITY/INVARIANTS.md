# cubeless — Invariants

Last updated: 2025-12-26

## I-1: Ownership gate
Mint must revert if any referenced NFT is not owned by `msg.sender` or if `ownerOf` reverts.

## I-2: Ref count bounds
`refs.length` must be in `[1..6]` or mint reverts.

## I-3: Payment boundary
`msg.value < currentMintPrice()` must revert; `msg.value >= currentMintPrice()` must succeed (subject to receiver policy).

## I-4: Refund exactness
On success, refund equals `msg.value - currentMintPrice()` (if any).

## I-5: Mint payout exactness
RoyaltySplitter receives exactly `currentMintPrice()` on each successful mint.

## I-6: TokenId determinism
TokenId is derived from `msg.sender`, `salt`, and `refsHash`, and mint must revert on replay collisions.

## I-6b: Balance matches mint count
For the minting handler address, `balanceOf(handler) == mintCount`.

## I-7: ERC-2981 receiver correctness
`royaltyInfo(tokenId, salePrice)` always returns the configured receiver and `salePrice * bps / 10000`.

## I-8: RoyaltySplitter fallback
- Router unset → forwards 100% ETH to owner.
- Router reverts → forwards 100% ETH to owner.
- Router succeeds → sends 50% ETH to owner, swaps 50% to $LESS, then splits $LESS 90% owner / 10% burn.

## I-9: Reentrancy safety
Reentrancy via owner/refund/PoolManager calls must not mint extra tokens or corrupt state.
