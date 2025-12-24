# cubeless — Invariants

## I-1: Ownership gate
Mint must revert if any referenced NFT is not owned by `msg.sender` or if `ownerOf` reverts.

## I-2: Ref count bounds
`refs.length` must be in `[1..6]` or mint reverts.

## I-3: Payment boundary
`msg.value < MINT_PRICE` must revert; `msg.value >= MINT_PRICE` must succeed (subject to receiver policy).

## I-4: Refund exactness
On success, refund equals `msg.value - MINT_PRICE` (if any).

## I-5: Mint payout exactness
Owner receives exactly `MINT_PRICE` on each successful mint.

## I-6: TokenId monotonicity
Each successful mint increments the tokenId by 1.

## I-7: ERC-2981 receiver correctness
`royaltyInfo(tokenId, salePrice)` always returns the configured receiver and `salePrice * bps / 10000`.

## I-8: RoyaltySplitter fallback
- Router unset → forwards 100% ETH to owner.
- Router reverts → forwards 100% ETH to owner.
- Router succeeds → forwards $LESS to owner, then remaining ETH to owner.

## I-9: Reentrancy safety
Reentrancy via owner/refund/router calls must not mint extra tokens or corrupt state.
