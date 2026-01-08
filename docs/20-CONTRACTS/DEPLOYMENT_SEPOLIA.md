# cubixles_ Deployment (CubixlesMinter, Mainnet + Base + Sepolia)

Last updated: 2026-01-08

## Review Status

- Last reviewed: 2026-01-08
- Review status: Updated
- Owner: danyel-ii

## Mint Signature

```solidity
mint(bytes32 salt, string calldata tokenURI, NftRef[] calldata refs) external payable returns (uint256 tokenId)
```

Commit signature (required before mint):

```solidity
commitMint(bytes32 salt, bytes32 refsHash) external
```

`NftRef` shape:

```solidity
struct NftRef {
    address contractAddress;
    uint256 tokenId;
}
```

## Payable Semantics

- `mint` is payable.
- `commitMint` must be called first; reveal must occur after the commit is mined (next block or later) and within 256 blocks.
- Mint price is dynamic and derived from $LESS totalSupply (base `0.0015 ETH` with a 1.0–2.0 factor), rounded up to the nearest `0.0001 ETH`.
- TokenId is deterministic from `msg.sender`, `salt`, and `refsHash` (previewable via `previewTokenId`).
- Mint pays the RoyaltySplitter and refunds any excess.
- If the payout transfer fails, the mint reverts (no partial transfers).

## Gating Rules

- `refs.length` must be between 1 and 6.
- Each referenced NFT must be ERC-721 and owned by `msg.sender` (`ownerOf` gating).
- ERC-1155 is not supported in v0.

## Royalty Policy

- Mint-time payout goes to `RoyaltySplitter`.
- Resale royalties use ERC-2981 with default 5% BPS, paid to `RoyaltySplitter`.
  - RoyaltySplitter swaps half the royalty via the v4 PoolManager when enabled; otherwise it forwards ETH to owner.
  - If the swap fails, the full amount is forwarded to owner.
  - If the swap succeeds, 50% of ETH is sent to owner, the remaining ETH is swapped to $LESS, then $LESS is split 90% owner / 10% burn.
  - If `CUBIXLES_POOL_MANAGER` is unset, swap is disabled and all ETH is forwarded.

## Admin Controls

- `setRoyaltyReceiver(resaleSplitter)` (resets bps to 5%)
- `setResaleRoyalty(bps, receiver)` (bps capped at 10%)

## Deployment Inputs

Environment variables read by `contracts/script/DeployCubixles.s.sol`:

- Note: env var names use `CUBIXLES_*` for compatibility with existing deploy tooling.
- `CUBIXLES_OWNER`
- `CUBIXLES_LESS_TOKEN` (optional; use `0x0` to disable LESS pricing)
- `CUBIXLES_LINEAR_PRICING_ENABLED` (optional; required for Base linear pricing)
- `CUBIXLES_BASE_MINT_PRICE_WEI` (optional; base price for linear pricing)
- `CUBIXLES_BASE_MINT_PRICE_STEP_WEI` (optional; step price for linear pricing)
- `CUBIXLES_FIXED_MINT_PRICE_WEI` (required when LESS + linear pricing are disabled)
- `CUBIXLES_BURN_ADDRESS` (optional, defaults to `0x000000000000000000000000000000000000dEaD`)
- `CUBIXLES_POOL_MANAGER` (optional, leave unset for no-swap mode)
- `CUBIXLES_POOL_FEE` (optional, defaults to 0)
- `CUBIXLES_POOL_TICK_SPACING` (required if pool manager is set)
- `CUBIXLES_POOL_HOOKS` (optional, defaults to `0x0000000000000000000000000000000000000000`)
- `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS` (optional, defaults to 0; max 1000)
- `CUBIXLES_RESALE_BPS` (optional, defaults to 500)
- `CUBIXLES_CHAIN_ID` (optional, defaults to `block.chainid`)
- `CUBIXLES_DEPLOYMENT_PATH` (optional; defaults to `contracts/deployments/<chain>.json`)

Base deployments require `CUBIXLES_LESS_TOKEN=0x0000000000000000000000000000000000000000` and `CUBIXLES_LINEAR_PRICING_ENABLED=true` (fixed pricing must be unset/0).
