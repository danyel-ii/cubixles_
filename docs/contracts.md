# cubixles_ Contracts

## Contract set
- `contracts/src/cubixles/CubixlesMinter.sol` (legacy minter)
- `contracts/src/royalties/RoyaltySplitter.sol` (legacy royalty receiver + swapper)
- `contracts/src/royalties/OwnerPayoutSplitter.sol` (builder owner payout swapper)
- `contracts/src/builders/CubixlesBuilderMinter.sol` (builder minter)
- `contracts/src/royalties/BuilderRoyaltyForwarder.sol` (per-mint royalty receiver)
- `contracts/src/cubixles_v.1.0..sol` (v1.0 marker contract)

## CubixlesMinter (legacy)
- ERC-721 with ERC-2981 resale royalties.
- Minting uses commit-reveal with deterministic tokenId derived from `minter + salt + refsHash`.
- Pricing modes:
  - Mainnet: dynamic price from $LESS totalSupply (base + factor + rounding).
  - Base: immutable linear pricing (base + step).
  - Optional fixed pricing if LESS and linear pricing are disabled.
- Mint gating requires 1..6 ERC-721 references owned by the minter.
- Metadata is pinned offchain; onchain stores `tokenURI`, palette commitments, and mint price snapshots.
- Resale royalties default to 5% and are routed to `RoyaltySplitter`.

## RoyaltySplitter (legacy)
- ERC-2981 receiver for legacy mints and resales.
- In swap-enabled mode, forwards ETH and swaps into LESS + PNKSTR via Uniswap v4 PoolManager.
- In swap-disabled or failure mode, forwards ETH to the owner.

## OwnerPayoutSplitter (builder owner share)
- Receives the builder owner share and optionally swaps 50% of incoming ETH into PNKSTR.
- Forwards remaining ETH + swapped PNKSTR to the owner.
- Uses Uniswap v4 PoolManager unlock/swap; falls back to ETH on swap failure or when disabled.

## CubixlesBuilderMinter (builder)
- ERC-721 with per-token ERC-2981 royalties.
- Quote-based pricing: a signed EIP-712 quote supplies total floor sum and expiry.
- Mint price = `0.0055 ETH + (totalFloorWei * 5%)` (PRICE_BPS = 500).
- References must support ERC-721 + ERC-2981 and be owned by the minter.
- Each face floor uses a 0.01 ETH clamp when the floor is unavailable, zero, or below 0.01 ETH.
- Payouts: 8.5% of the mint price per referenced NFT goes to the referenced NFT royalty receiver; remainder routes to the owner payout address (defaults to owner).
- `mintBuildersWithMetadata` stores `tokenURI` and `metadataHash` per token.

## BuilderRoyaltyForwarder
- Minimal per-mint royalty receiver deployed via `Clones`.
- Default behavior forwards 100% to the minter (owner of the forwarder).
- Minter can set custom split recipients and bps; unpaid sends accrue as `pending` and are withdrawable.

## CubixlesV1_0 marker
- Empty marker contract deployed alongside legacy deployments to preserve the v1.0 snapshot.
- Include it in builder deployment artifacts for consistency and source verification.

## Deployment overview
- Legacy deploy script: `contracts/script/DeployCubixles.s.sol`.
- Builder deploy script: `contracts/script/DeployBuilderMinter.s.sol`.
- Timelock deploy script: `contracts/script/DeployTimelock.s.sol` (legacy ownership transfer).

## Builder deployment plan
- Configure builder deployment inputs:
  - `CUBIXLES_BUILDER_OWNER` (or `CUBIXLES_OWNER` fallback)
  - `CUBIXLES_BUILDER_OWNER_PAYOUT` (optional; routes owner share to a splitter)
  - `CUBIXLES_BUILDER_QUOTE_SIGNER` (required for minting)
  - `CUBIXLES_BUILDER_ROYALTY_FORWARDER_IMPL` (optional; deploys a new implementation when unset)
  - `CUBIXLES_BUILDER_NAME`, `CUBIXLES_BUILDER_SYMBOL`, `CUBIXLES_BUILDER_BASE_URI`
  - `CUBIXLES_CHAIN_ID`, `CUBIXLES_BUILDER_DEPLOYMENT_PATH`
- Record builder minter + forwarder implementation addresses in the deployment JSON.
- Include the `CubixlesV1_0` marker contract in the deployment artifact list (deploy it if you want parity with the legacy deployment set).
