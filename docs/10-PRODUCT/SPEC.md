# cubixles_ Miniapp v0 Spec — Provenance Shapes (Mainnet)

Last updated: 2026-01-02

## Review Status

- Last reviewed: 2026-01-02
- Review status: Needs confirmation
- Owner: danyel-ii

This document defines the required data shapes and normalization rules for
wallet inventory and provenance objects in v0. These rules are mandatory for
all downstream tasks (Alchemy indexer, picker UI, mint metadata).

## Scope

- Chain: Ethereum mainnet (`chainId: 1`).
- Two types: `NftItem` (inventory UI), `ProvenanceBundle` (mint metadata).
- No UI or contract logic in this doc.
- Inventory and metadata reads are proxied through server routes (`/api/nfts`), not direct client keys.

## Core Rules (v0)

1. **Chain gating**: only allow `chainId === 1`.
   - If anything else is supplied, return a clear error and block selection.
2. **tokenId**: must be a decimal string derived from `BigInt`.
   - Parse raw IDs as `BigInt` first.
   - Store as base-10 string to support large token IDs.
3. **token standard**: only allow ERC-721 (`ownerOf` gating).
   - Skip/ignore non-ERC-721 items (ERC-1155 is intentionally unsupported in v0).
   - Rationale: ERC-1155 introduces balances and shared metadata that do not map cleanly to the 1-of-1 provenance flow.
4. **contractAddress**: must be **EIP-55 checksum** string.
5. **URI normalization**: store `{ original, resolved }` for both `tokenUri` and `image`.
   - `original` is the exact value returned by the source.
   - `resolved` converts `ipfs://…` to an HTTPS gateway URL.
6. **Raw metadata**: provenance stores full source metadata as received.
7. **Floor snapshot (optional)**: store collection floor ETH + retrieval timestamp at mint time.
   - Default: `0` when floor data is unavailable.

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
  chainId: 1;
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
  chainId: 1;
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
  chainId: 1;
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
- `external_url` should point to the token viewer route (e.g. `https://<domain>/m/<tokenId>`).
- `image` is the palette image (gateway URL), and `image_ipfs` holds the ipfs:// URI for wallets.
- `provenance` stores the full bundle for traceability.
- `provenance.refsFaces` preserves face order; `provenance.refsCanonical` is the sorted list used for tokenId hashing.

```ts
type MintMetadata = {
  schemaVersion: 1;
  name: string;
  description: string;
  image: string | null; // palette image (gateway URL)
  image_ipfs?: string | null; // ipfs://... for wallets
  external_url: string | null; // https://<domain>/m/<tokenId>
  attributes: Array<{ trait_type: string; value: string | number }>;
  provenance: ProvenanceBundle & {
    schemaVersion: 1;
    mintedBy: string;
    refs: Array<{ contractAddress: string; tokenId: string }>;
    refsFaces?: Array<{ contractAddress: string; tokenId: string }>;
    refsCanonical?: Array<{ contractAddress: string; tokenId: string }>;
  };
  references: Array<{
    chainId: 1;
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
- Mint supply is capped at 32,768 total mints.
- Mint fee is forwarded to RoyaltySplitter (same split logic as royalties).
- Resale royalty (ERC-2981): `5%` with receiver = RoyaltySplitter (sends 50% ETH to owner, swaps 50% to $LESS, then splits $LESS 90% owner / 10% burn).

Base ETH-only mode:
- When `LESS_TOKEN` is disabled on deployment, mint price is fixed (`fixedMintPriceWei`) and can be updated by the owner.
- $LESS snapshots and delta metrics are disabled (stored as `0`) on Base.

## Deterministic TokenId

- `tokenId = keccak256("cubixles_:tokenid:v1", minter, salt, refsHash)`
- `refsHash` is computed from a canonical sort of refs (by contract + tokenId).
- Clients call `previewTokenId(salt, refs)` to build metadata before mint.

## Commit-Reveal Mint Flow

- Minting uses a two-step commit-reveal:
  1. `commitMint(salt, refsHash)` stores a commitment and block number.
  2. `mint(salt, tokenURI, refs)` reveals refs + salt and completes the mint.
- The reveal must occur within 256 blocks of the commit.
- Random palette index is derived from `refsHash`, `salt`, minter, and the commit block hash.
- The UI prompts two wallet confirmations and auto-advances to the mint step after the commit is confirmed.

## $LESS Delta Metric (UI/Leaderboard)

- The contract snapshots $LESS totalSupply at mint and on transfer (totalSupply is treated as remaining supply).
- The canonical UI/leaderboard metric is `deltaFromLast(tokenId)` (snapshot minus current supply, clamped to 0).
- The UI “$LESS supply” HUD displays remaining supply as `totalSupply - balanceOf(BURN_ADDRESS)` using the server-side RPC proxy.
- On Base, the HUD and leaderboard do not use $LESS deltas.

## Token Viewer Route

- `external_url` resolves to `https://<domain>/m/<tokenId>`.
- The viewer reads `tokenURI`, extracts `provenance.refs`, and renders the cube with those textures.
- OG previews are rendered at `/m/<tokenId>/opengraph-image` for link shares.

## Palette Mapping

- The in-wallet static image is chosen from a 10,000-image IPFS folder using the onchain random index.
- A manifest JSON maps random indices to filenames and palette metadata.
- `image` points to the palette image (gateway URL).
- The palette-specific image URL is stored under `palette.image_url`.

## Farcaster Frame Embed

- The home page includes an `fc:frame` definition in the HTML head.
- The home page also includes an `fc:miniapp` definition for discovery.
- Frame definition fields:
  - `imageUrl` (3:2) points to the social preview image.
  - `button.title` is the CTA label.
  - `button.action.type` is `launch_frame`.
  - `button.action.url` is the home URL.
  - `splashImageUrl` + `splashBackgroundColor` are set for the miniapp launch screen.
