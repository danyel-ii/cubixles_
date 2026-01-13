# cubixles_ Deployment (CubixlesMinter, Mainnet + Base + Sepolia)

Last updated: 2026-01-10

## Review Status

- Last reviewed: 2026-01-10
- Review status: Updated
- Owner: danyel-ii

## Mint Signature

```solidity
mint(
    bytes32 salt,
    NftRef[] calldata refs,
    uint256 expectedPaletteIndex,
    string calldata tokenURI,
    bytes32 metadataHash,
    bytes32 imagePathHash
) external payable returns (uint256 tokenId)
```

Commit signature (required before mint):

```solidity
commitMint(bytes32 commitment) external
```

Metadata commit (required before mint):

```solidity
commitMetadata(bytes32 metadataHash, bytes32 imagePathHash, uint256 expectedPaletteIndex) external
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
- `commitMint` must be called first; reveal must occur after the reveal block hash is available (commit block + delay) and within 256 blocks.
- Commits are free. Repeated cancellations can trigger a cooldown (`commitCancelThreshold` + `commitCooldownBlocks`).
- `commitMetadata` must be called after the reveal block is available to lock `metadataHash` and `imagePathHash` and assign the palette index.
- Mint price is dynamic and derived from $LESS totalSupply (base `0.0022 ETH` with a 1.0–4.0 factor), rounded up to the nearest `0.0001 ETH`.
- TokenId is deterministic from `msg.sender`, `salt`, and `refsHash` (previewable via `previewTokenId`).
- Mint pays the RoyaltySplitter and refunds any excess from `msg.value`.
- If the payout transfer fails, the mint reverts (no partial transfers).
- `tokenURI` is stored per mint (pinned offchain), and the contract stores `paletteImagesCID` + `paletteManifestHash` plus per-token `metadataHash` + `imagePathHash` commitments.

## Gating Rules

- `refs.length` must be between 1 and 6.
- Each referenced NFT must be ERC-721 and owned by `msg.sender` (`ownerOf` gating).
- ERC-1155 is not supported in v0.

## Royalty Policy

- Mint-time payout goes to `RoyaltySplitter`.
- Resale royalties use ERC-2981 with default 5% BPS, paid to `RoyaltySplitter`.
  - RoyaltySplitter swaps 25% to $LESS and 50% to $PNKSTR via the v4 PoolManager when enabled; otherwise it forwards ETH to owner.
  - If the swap fails, the full amount is forwarded to owner.
  - If the swap succeeds, 25% of ETH is sent to owner, 25% is swapped to $LESS (owner), and 50% is swapped to $PNKSTR (owner).
  - If `CUBIXLES_POOL_MANAGER` is unset, swap is disabled and all ETH is forwarded.

## Admin Controls

- `setRoyaltyReceiver(resaleSplitter)` (resets bps to 5%)
- `setResaleRoyalty(bps, receiver)` (bps capped at 10%)
- `setCommitCooldownBlocks(blocks)` updates the cooldown after repeated cancellations
- `setCommitCancelThreshold(threshold)` updates the cancellations required before cooldown
- `setFixedMintPrice(price)` updates fixed pricing when LESS + linear pricing are disabled

## Deployment Inputs

Environment variables read by `contracts/script/DeployCubixles.s.sol`:

- Note: env var names use `CUBIXLES_*` for compatibility with existing deploy tooling.
- See `.env.sepolia.example` for a ready-to-fill Sepolia config template.
- `CUBIXLES_OWNER`
- `CUBIXLES_LESS_TOKEN` (optional; use `0x0` to disable LESS pricing)
- `CUBIXLES_LINEAR_PRICING_ENABLED` (optional; required for Base linear pricing)
- `CUBIXLES_BASE_MINT_PRICE_WEI` (optional; base price for linear pricing)
- `CUBIXLES_BASE_MINT_PRICE_STEP_WEI` (optional; step price for linear pricing)
- `CUBIXLES_FIXED_MINT_PRICE_WEI` (required when LESS + linear pricing are disabled)
- `CUBIXLES_COMMIT_CANCEL_THRESHOLD` (optional; cancellations before cooldown)
- `CUBIXLES_COMMIT_COOLDOWN_BLOCKS` (optional; cooldown length in blocks)
- `CUBIXLES_PALETTE_IMAGES_CID` (required; base CID for palette images)
- `CUBIXLES_PALETTE_MANIFEST_HASH` (required; keccak256 hash of the manifest JSON)
- `CUBIXLES_POOL_MANAGER` (optional, leave unset for no-swap mode)
- `CUBIXLES_LESS_POOL_FEE` (optional, defaults to 0)
- `CUBIXLES_LESS_POOL_TICK_SPACING` (required if pool manager is set)
- `CUBIXLES_LESS_POOL_HOOKS` (optional, defaults to `0x0000000000000000000000000000000000000000`)
- `CUBIXLES_PNKSTR_TOKEN` (optional; required for swaps)
- `CUBIXLES_PNKSTR_POOL_FEE` (optional, defaults to 0)
- `CUBIXLES_PNKSTR_POOL_TICK_SPACING` (required if pool manager is set)
- `CUBIXLES_PNKSTR_POOL_HOOKS` (optional, defaults to `0x0000000000000000000000000000000000000000`)
- `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS` (optional, defaults to 0; max 1000)
- `CUBIXLES_RESALE_BPS` (optional, defaults to 500)
- `CUBIXLES_CHAIN_ID` (optional, defaults to `block.chainid`)
- `CUBIXLES_DEPLOYMENT_PATH` (optional; defaults to `contracts/deployments/<chain>.json`)

Base deployments require `CUBIXLES_LESS_TOKEN=0x0000000000000000000000000000000000000000` and `CUBIXLES_LINEAR_PRICING_ENABLED=true` (fixed pricing must be unset/0). Set `CUBIXLES_POOL_MANAGER=0x0`, `CUBIXLES_LESS_POOL_FEE=0`, `CUBIXLES_LESS_POOL_TICK_SPACING=0`, `CUBIXLES_LESS_POOL_HOOKS=0x0`, and `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS=0` to fully disable swaps on Base.

## Sepolia rehearsal

```sh
npm run deploy:sepolia
# or dry-run:
npm run deploy:sepolia:dry
```

The deploy script writes to `contracts/deployments/sepolia.json` by default (override with `CUBIXLES_DEPLOYMENT_PATH`).

## Timelock deployment

Use `contracts/script/DeployTimelock.s.sol` to deploy a `TimelockController` and transfer ownership
of the minter and splitter:

- `CUBIXLES_TIMELOCK_MIN_DELAY`
- `CUBIXLES_TIMELOCK_ADMIN`
- `CUBIXLES_TIMELOCK_PROPOSER`
- `CUBIXLES_TIMELOCK_EXECUTOR`
- Reads minter + splitter from `contracts/deployments/<chain>.json` (override with `CUBIXLES_DEPLOYMENT_PATH`)
