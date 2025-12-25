# cubeless Deployment (IceCubeMinter, Sepolia)

## Review Status

- Last reviewed: 2025-12-23
- Review status: Needs confirmation
- Owner: TBD

## Mint Signature

```
mint(bytes32 salt, string tokenURI, NftRef[] refs) payable returns (uint256 tokenId)
```

`NftRef` shape:

```
struct NftRef {
  address contractAddress;
  uint256 tokenId;
}
```

## Payable Semantics

- `mint` is payable.
- Mint price is dynamic and derived from $LESS totalSupply (base `0.0015 ETH` with a 1.0–2.0 factor), rounded up to the nearest `0.0001 ETH`.
- TokenId is deterministic from `msg.sender`, `salt`, and `refsHash` (previewable via `previewTokenId`).
- Mint pays the owner directly and refunds any excess.
- If the owner transfer fails, the mint reverts (no partial transfers).

## Gating Rules

- `refs.length` must be between 1 and 6.
- Each referenced NFT must be ERC-721 and owned by `msg.sender` (`ownerOf` gating).
- ERC-1155 is not supported in v0.

## Royalty Policy

- Mint-time payout goes to `owner()`.
- Resale royalties use ERC-2981 with default 5% BPS, paid to `RoyaltySplitter`.
  - RoyaltySplitter calls a router with half the royalty when configured; otherwise it forwards ETH to owner.
  - If the router call fails, the full amount is forwarded to owner.
  - If the router call succeeds, any $LESS received is split 50% to burn address and 50% to owner before forwarding remaining ETH.

## Admin Controls

- `setRoyaltyReceiver(resaleSplitter)` (resets bps to 5%)
- `setResaleRoyalty(bps, receiver)` (bps capped at 10%)

## Deployment Inputs

Environment variables read by `contracts/script/DeployIceCube.s.sol`:

- `ICECUBE_OWNER`
- `ICECUBE_LESS_TOKEN` (optional, defaults to mainnet $LESS address)
- `ICECUBE_BURN_ADDRESS` (optional, defaults to `0x000000000000000000000000000000000000dEaD`)
- `ICECUBE_ROUTER` (optional, leave unset for no-swap mode)
- `ICECUBE_SWAP_CALLDATA` (optional, router calldata)
- `ICECUBE_RESALE_BPS` (optional, defaults to 500)
