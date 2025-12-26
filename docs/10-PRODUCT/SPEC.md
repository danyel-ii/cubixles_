# cubeless Miniapp v0 Spec — Provenance Shapes (Sepolia)

Last updated: 2025-12-26

## Review Status

- Last reviewed: 2025-12-26
- Review status: Needs confirmation
- Owner: TBD

This document defines the required data shapes and normalization rules for
wallet inventory and provenance objects in v0. These rules are mandatory for
all downstream tasks (Alchemy indexer, picker UI, mint metadata).

## Scope

- Chain: Sepolia only (`chainId: 11155111`).
- Two types: `NftItem` (inventory UI), `ProvenanceBundle` (mint metadata).
- No UI or contract logic in this doc.
- Inventory and metadata reads are proxied through server routes (`/api/nfts`), not direct client keys.

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
6. **Raw metadata**: provenance stores full source metadata as received.
7. **Floor snapshot (optional)**: store collection floor ETH + retrieval timestamp at mint time.
   - Sepolia default: `0` when floor data is unavailable.

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
  collectionFloorEth?: number;
  collectionFloorRetrievedAt?: string | null;
};
```

Notes:
- `tokenUri` and `image` may be null if metadata is missing or invalid.
- `source: "alchemy"` indicates the upstream provider; the browser uses `/api/nfts` for access.

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
  collectionFloorEth?: number;
  collectionFloorRetrievedAt?: string | null;
};
```

### `ProvenanceBundle`

```ts
type ProvenanceBundle = {
  chainId: 11155111;
  selectedBy: string; // EIP-55 checksum wallet address
  retrievedAt: string; // ISO timestamp
  nfts: ProvenanceNft[]; // length 1..6
  floorSummary?: {
    sumFloorEth: number;
  };
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

Notes:
- `animation_url` should point to the token viewer route (e.g. `https://<domain>/m/<tokenId>`).
- `image` is an optional static thumbnail for marketplaces (GIF library).
- `provenance` stores the full bundle for traceability.
- `provenance.refsFaces` preserves face order; `provenance.refsCanonical` is the sorted list used for tokenId hashing.

```ts
type MintMetadata = {
  schemaVersion: 1;
  name: string;
  description: string;
  image: string | null; // pre-generated GIF thumbnail
  animation_url: string | null; // https://<domain>/m/<tokenId>
  gif: {
    variantIndex: number;
    selectionSeed: string;
    params: {
      rgb_sep_px: number;
      band_shift_px: number;
      grain_intensity: number;
      contrast_flicker: number;
      solarization_strength: number;
    };
  };
  attributes: Array<{ trait_type: string; value: string | number }>;
  provenance: ProvenanceBundle & {
    schemaVersion: 1;
    mintedBy: string;
    refs: Array<{ contractAddress: string; tokenId: string }>;
    refsFaces?: Array<{ contractAddress: string; tokenId: string }>;
    refsCanonical?: Array<{ contractAddress: string; tokenId: string }>;
  };
  references: Array<{
    chainId: 11155111;
    contractAddress: string;
    tokenId: string;
    tokenIdNumber: number | null; // null if > MAX_SAFE_INTEGER
    image: ResolvedUri | null;
    collectionFloorEth?: number;
    collectionFloorRetrievedAt?: string | null;
  }>;
  provenanceSummary?: {
    sumFloorEth: number;
  };
};
```

## Mint Economics (v0)

- Mint price is **dynamic** based on $LESS totalSupply:
  - base price `0.0015 ETH`
  - factor `1 + (1B - supply) / 1B` (clamped at 1.0 when supply ≥ 1B)
  - rounded up to the nearest `0.0001 ETH`
- Mint accepts `msg.value >= currentMintPrice()` and refunds overpayment.
- Resale royalty (ERC-2981): `5%` with receiver = RoyaltySplitter (splits $LESS 50% burn / 50% owner on successful swap).

## Deterministic TokenId

- `tokenId = keccak256("cubeless:tokenid:v1", minter, salt, refsHash)`
- `refsHash` is computed from a canonical sort of refs (by contract + tokenId).
- Clients call `previewTokenId(salt, refs)` to build metadata before mint.

## $LESS Delta Metric (UI/Leaderboard)

- The contract snapshots $LESS totalSupply at mint and on transfer (totalSupply is treated as remaining supply).
- The canonical UI/leaderboard metric is `deltaFromLast(tokenId)` (snapshot minus current supply, clamped to 0).
 - The UI “$LESS supply” HUD displays remaining supply as `totalSupply - balanceOf(BURN_ADDRESS)` using the server-side RPC proxy.

## Token Viewer Route

- `animation_url` resolves to `https://<domain>/m/<tokenId>`.
- The viewer reads `tokenURI`, extracts `provenance.refs`, and renders the cube with those textures.
