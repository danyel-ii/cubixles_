# IceCubeMinter Deployment (Sepolia)

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
- No on-chain mint price is enforced; `msg.value` is split according to the royalty policy.

## Gating Rules

- `refs.length` must be between 1 and 6.
- Each referenced NFT must be ERC-721 and owned by `msg.sender` (`ownerOf` gating).
- ERC-1155 is not supported in v0.

## Royalty Policy

- Mint-time split of `msg.value`:
  - 20% `creator`
  - 40% `$Less` treasury
  - 20% `$PNKSTR` treasury
  - 20% `poolTreasury` placeholder
- Resale royalties use ERC-2981 with default 5% BPS, paid to `poolTreasury`.

## Admin Controls

- `setRoyaltyReceivers(creator, lessTreasury, pnkstrTreasury, poolTreasury)`
- `setResaleRoyalty(bps, receiver)`

## Deployment Inputs

Environment variables read by `contracts/script/DeployIceCube.s.sol`:

- `ICECUBE_CREATOR`
- `ICECUBE_LESS_TREASURY`
- `ICECUBE_PNKSTR_TREASURY`
- `ICECUBE_POOL_TREASURY`
- `ICECUBE_RESALE_BPS` (optional, defaults to 500)
