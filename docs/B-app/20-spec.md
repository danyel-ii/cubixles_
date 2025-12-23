# IceCube Miniapp v0 Spec — Provenance Shapes (Sepolia)

This document defines the required data shapes and normalization rules for
wallet inventory and provenance objects in v0. These rules are mandatory for
all downstream tasks (Alchemy indexer, picker UI, mint metadata).

## Scope

- Chain: Sepolia only (`chainId: 11155111`).
- Two types: `NftItem` (inventory UI), `ProvenanceBundle` (mint metadata).
- No UI or contract logic in this doc.

## Core Rules (v0)

1. **Chain gating**: only allow `chainId === 11155111`.
   - If anything else is supplied, return a clear error and block selection.
2. **tokenId**: must be a decimal string derived from `BigInt`.
   - Parse raw IDs as `BigInt` first.
   - Store as base-10 string to support large token IDs.
3. **token standard**: only allow ERC-721 (`ownerOf` gating).
   - Skip/ignore non-ERC-721 items.
4. **contractAddress**: must be **EIP-55 checksum** string.
5. **URI normalization**: store `{ original, resolved }` for both `tokenUri` and `image`.
   - `original` is the exact value returned by the source.
   - `resolved` converts `ipfs://…` to an HTTPS gateway URL.
5. **Raw metadata**: provenance stores full source metadata as received.

## Types

### `ResolvedUri`

```ts
type ResolvedUri = {
  original: string;
  resolved: string;
};
```

### `NftItem` (Inventory UI)

```ts
type NftItem = {
  chainId: 11155111;
  contractAddress: string; // EIP-55 checksum
  tokenId: string; // base-10 string
  name: string | null;
  collectionName: string | null;
  tokenUri: ResolvedUri | null;
  image: ResolvedUri | null;
  source: "alchemy";
};
```

Notes:
- `tokenUri` and `image` may be null if metadata is missing or invalid.

### `ProvenanceNft`

```ts
type ProvenanceNft = {
  chainId: 11155111;
  contractAddress: string; // EIP-55 checksum
  tokenId: string; // base-10 string
  tokenUri: ResolvedUri | null;
  image: ResolvedUri | null;
  sourceMetadata: {
    raw: Record<string, unknown> | null; // full metadata JSON
  };
  retrievedVia: "alchemy";
  retrievedAt: string; // ISO timestamp
};
```

### `ProvenanceBundle`

```ts
type ProvenanceBundle = {
  chainId: 11155111;
  selectedBy: string; // EIP-55 checksum wallet address
  retrievedAt: string; // ISO timestamp
  nfts: ProvenanceNft[]; // length 1..6
};
```

## TokenId Policy

- Parse `tokenId` as `BigInt` from source.
- Store as a base-10 string to avoid JS safe integer limits.

## Checksum Policy

- Normalize `contractAddress` and `selectedBy` to EIP-55 before storage.
- Reject non-checksummable addresses with a clear error.

## URI Resolution Policy

- If `original` starts with `ipfs://`, resolve via gateway:
  - `resolved = "https://ipfs.io/ipfs/" + original.replace("ipfs://", "")`
- If `original` is already HTTPS, `resolved = original`.
- Always store both `original` and `resolved`.

## Face Mapping

v0 mapping order (fixed):

- Faces are ordered `+X, -X, +Y, -Y, +Z, -Z`.
- Assign selected NFTs in order of selection.
- If fewer than 6 are selected, remaining faces use a frosted glass texture.

## Mint Metadata Schema (tokenURI JSON)

```ts
type MintMetadata = {
  schemaVersion: 1;
  name: string;
  description: string;
  image: string | null;
  provenanceBundle: ProvenanceBundle;
  references: Array<{
    chainId: 11155111;
    contractAddress: string;
    tokenId: string;
    tokenIdNumber: number | null; // null if > MAX_SAFE_INTEGER
    image: ResolvedUri | null;
  }>;
};
```
