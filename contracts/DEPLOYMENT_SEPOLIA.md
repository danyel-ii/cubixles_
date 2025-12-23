# cubeless Deployment (IceCubeMinter, Sepolia)

## Review Status

- Last reviewed: 2025-12-23
- Review status: Needs confirmation
- Owner: TBD

## Mint Signature

```
mint(string tokenURI, NftRef[] refs) payable returns (uint256 tokenId)
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
- Mint price is fixed at 0.0027 ETH.
- Mint royalty is 10% of the mint price (0.00027 ETH) and is added on top.
- If an NFT does not support ERC-2981, its royalty slice is skipped and not charged.
- If any royalty receiver reverts, the mint reverts (no partial transfers).

## Gating Rules

- `refs.length` must be between 1 and 6.
- Each referenced NFT must be ERC-721 and owned by `msg.sender` (`ownerOf` gating).
- ERC-1155 is not supported in v0.

## Royalty Policy

- Mint-time split of `msg.value`:
  - 20% `creator`
  - 20% `$Less` treasury (placeholder for buy)
  - 60% split equally per referenced NFT contract (ERC-2981 receiver)
- Resale royalties use ERC-2981 with default 5% BPS, paid to `resaleSplitter`.
  - Mint uses a reentrancy guard around the payable split.

## Admin Controls

- `setRoyaltyReceivers(creator, lessTreasury, resaleSplitter)`
- `setResaleRoyalty(bps, receiver)`

## Deployment Inputs

Environment variables read by `contracts/script/DeployIceCube.s.sol`:

- `ICECUBE_CREATOR`
- `ICECUBE_LESS_TREASURY`
- `ICECUBE_RESALE_SPLITTER`
- `ICECUBE_RESALE_BPS` (optional, defaults to 500)
