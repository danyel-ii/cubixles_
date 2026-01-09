# cubixles_ Deployment (CubixlesMinter, Mainnet + Base + Sepolia)

Last updated: 2026-01-09

## Review Status

- Last reviewed: 2026-01-09
- Review status: Updated
- Owner: danyel-ii

## Mint Signature

```solidity
mint(bytes32 salt, NftRef[] calldata refs) external payable returns (uint256 tokenId)
```

Commit signature (required before mint):

```solidity
commitMint(bytes32 commitment) external
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
- `commitMint` must be called first; reveal must occur after the commit is mined (next block or later) and within 256 blocks, and after VRF randomness is fulfilled.
- Mint price is dynamic and derived from $LESS totalSupply (base `0.0022 ETH` with a 1.0–4.0 factor), rounded up to the nearest `0.0001 ETH`.
- TokenId is deterministic from `msg.sender`, `salt`, and `refsHash` (previewable via `previewTokenId`).
- Mint pays the RoyaltySplitter and refunds any excess.
- If the payout transfer fails, the mint reverts (no partial transfers).
- `tokenURI` is computed onchain as `ipfs://<paletteMetadataCID>/<paletteIndex>.json`.

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
- `CUBIXLES_PALETTE_METADATA_CID` (required; base CID for palette metadata JSON)
- `CUBIXLES_BURN_ADDRESS` (optional, defaults to `0x000000000000000000000000000000000000dEaD`)
- `CUBIXLES_POOL_MANAGER` (optional, leave unset for no-swap mode)
- `CUBIXLES_POOL_FEE` (optional, defaults to 0)
- `CUBIXLES_POOL_TICK_SPACING` (required if pool manager is set)
- `CUBIXLES_POOL_HOOKS` (optional, defaults to `0x0000000000000000000000000000000000000000`)
- `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS` (optional, defaults to 0; max 1000)
- `CUBIXLES_RESALE_BPS` (optional, defaults to 500)
- `CUBIXLES_VRF_COORDINATOR` (required; Chainlink VRF coordinator)
- `CUBIXLES_VRF_KEY_HASH` (required; gas lane key hash)
- `CUBIXLES_VRF_SUBSCRIPTION_ID` (required; VRF subscription id)
- `CUBIXLES_VRF_REQUEST_CONFIRMATIONS` (optional, defaults to 3)
- `CUBIXLES_VRF_CALLBACK_GAS_LIMIT` (optional, defaults to 250000)
- `CUBIXLES_CHAIN_ID` (optional, defaults to `block.chainid`)
- `CUBIXLES_DEPLOYMENT_PATH` (optional; defaults to `contracts/deployments/<chain>.json`)

Base deployments require `CUBIXLES_LESS_TOKEN=0x0000000000000000000000000000000000000000` and `CUBIXLES_LINEAR_PRICING_ENABLED=true` (fixed pricing must be unset/0). Set `CUBIXLES_POOL_MANAGER=0x0`, `CUBIXLES_POOL_FEE=0`, `CUBIXLES_POOL_TICK_SPACING=0`, `CUBIXLES_POOL_HOOKS=0x0`, and `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS=0` to fully disable swaps on Base.

## Timelock deployment

Use `contracts/script/DeployTimelock.s.sol` to deploy a `TimelockController` and transfer ownership
of the minter and splitter:

- `CUBIXLES_TIMELOCK_MIN_DELAY`
- `CUBIXLES_TIMELOCK_ADMIN`
- `CUBIXLES_TIMELOCK_PROPOSER`
- `CUBIXLES_TIMELOCK_EXECUTOR`
- `CUBIXLES_MINTER_ADDRESS`
- `CUBIXLES_SPLITTER_ADDRESS`
