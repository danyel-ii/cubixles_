# cubixles_ Miniapp v0 Spec — Provenance Shapes (Mainnet + Base)

Last updated: 2026-01-10

## Review Status

- Last reviewed: 2026-01-10
- Review status: Updated
- Owner: danyel-ii

This document defines the required data shapes and normalization rules for
wallet inventory and provenance objects in v0. These rules are mandatory for
all downstream tasks (Alchemy indexer, picker UI, mint metadata).

## Scope

- Chains: Ethereum mainnet (`chainId: 1`) and Base (`chainId: 8453`).
- Sepolia is used only for rehearsal/testing via server endpoints; the UI supports mainnet + Base.
- Two types: `NftItem` (inventory UI), `ProvenanceBundle` (mint metadata).
- No UI or contract logic in this doc.
- Inventory and metadata reads are proxied through server routes (`/api/nfts`), not direct client keys.

## Core Rules (v0)

1. **Chain gating**: only allow supported chain IDs and ensure they match the active chain.
   - Supported chain IDs: `1` (mainnet) and `8453` (Base).
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
6. **Raw metadata**: provenance captures full source metadata during fetch; per-mint tokenURI metadata includes the curated provenance fields, while raw source metadata stays offchain.
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
  chainId: 1 | 8453;
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
  chainId: 1 | 8453;
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

Notes:
- The in-memory provenance bundle includes `sourceMetadata.raw` for offchain diagnostics; tokenURI metadata includes curated provenance fields, not the raw source JSON.

### `ProvenanceBundle`

```ts
type ProvenanceBundle = {
  chainId: 1 | 8453;
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

## Palette Metadata Schema (tokenURI JSON)

`tokenURI` is pinned per mint (for example: `ipfs://<metadataCid>`). Metadata is generated at mint
time and includes palette traits plus per-mint provenance. The contract stores
`paletteImagesCID` + `paletteManifestHash` to commit to the palette image set + manifest, plus
per-token `metadataHash` + `imagePathHash` commitments.

Notes:
- `external_url` is optional; it can point to `https://<domain>/m/<tokenId>` if precomputed offchain.
- `image` should reference the palette image (gateway URL or ipfs://).
- `attributes` should include palette index + traits (id, hex colors, rarity metrics).

```ts
type PaletteMetadata = {
  name: string;
  description?: string;
  image: string;
  external_url?: string | null;
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
};
```

## Mint Economics (v0)

- Mint price is **dynamic** based on $LESS totalSupply:
  - base price `0.0022 ETH`
  - factor `1 + (3 * (1B - supply)) / 1B` (clamped at 1.0 when supply ≥ 1B)
  - rounded up to the nearest `0.0001 ETH`
- Mint accepts `msg.value >= currentMintPrice()` and refunds overpayment.
- Mint supply is capped at 10,000 total mints.
- Mint fee is forwarded to RoyaltySplitter (same split logic as royalties).
- Resale royalty (ERC-2981): `5%` with receiver = RoyaltySplitter (sends 25% ETH to owner, swaps 25% to $LESS for the owner, swaps 50% to $PNKSTR for the owner).

Base ETH-only mode:
- On Base deployments, `LESS_TOKEN` is disabled and linear pricing is enabled (0.0012 ETH base + 0.000012 ETH per mint).
- Mint price is `baseMintPriceWei + (baseMintPriceStepWei * totalMinted)` (no rounding).
- `baseMintPriceWei` and `baseMintPriceStepWei` are immutable once deployed.
- $LESS snapshots and delta metrics are disabled (stored as `0`) on Base.
- If LESS and linear pricing are both disabled, `fixedMintPriceWei` is required.

## Deterministic TokenId

- `tokenId = keccak256("cubixles_:tokenid:v1", minter, salt, refsHash)`
- `refsHash` is computed from a canonical sort of refs (by contract + tokenId).
- Clients call `previewTokenId(salt, refs)` to build external URLs or offchain metadata before mint.

## Commit-Reveal Mint Flow

- Minting uses a hash-only commit-reveal with metadata hashing:
  1. `commitMint(commitment)` stores a commitment hash.
  2. After the reveal block hash is available, `commitMetadata(metadataHash, imagePathHash, expectedPaletteIndex)` locks the metadata hashes and assigns the palette index.
  3. `mint(salt, refs, expectedPaletteIndex, tokenURI, metadataHash, imagePathHash)` reveals refs + salt and completes the mint.
- Commitment hash = `keccak256("cubixles_:commit:v1", minter, salt, refsHash)`.
- The reveal must occur after the reveal block hash is available and within 256 blocks.
- Random palette index is derived from `keccak256(blockhash(revealBlock), commitment)` (random-without-replacement).
- The UI prompts three wallet confirmations (commit, metadata, mint) when no active commit exists.
- If a valid commit is already stored, the UI skips the commit tx and only prompts for metadata + mint.
- Commits are free; repeated cancellations can trigger a cooldown (`commitCancelThreshold`, `commitCooldownBlocks`).
- `metadataHash` is the keccak256 of the canonical metadata JSON.
- `imagePathHash` is the keccak256 of the palette image path (relative to `paletteImagesCID`).

## $LESS Delta Metric (UI/Leaderboard)

- The contract snapshots $LESS totalSupply at mint and on transfer (totalSupply is treated as remaining supply).
- The canonical UI/leaderboard metric is `deltaFromLast(tokenId)` (snapshot minus current supply, clamped to 0).
- The UI “$LESS supply” HUD displays remaining supply as `totalSupply - balanceOf(BURN_ADDRESS)` using the server-side RPC proxy.
- On Base, the HUD and leaderboard do not use $LESS deltas.

## Token Viewer Route

- `external_url` resolves to `https://<domain>/m/<tokenId>`.
- The viewer reads `tokenURI` metadata for palette traits and image assets.
- Provenance refs are rendered only when metadata includes `provenance` (legacy/offchain metadata). Palette-only metadata will not include refs and will skip provenance-based rendering.
- When provenance is present, the viewer expects `provenance.chainId` to match the active chain; it uses `provenance.chainId` for floor snapshot labels/OpenSea links and the active chain config for Alchemy lookups.
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
  - `version` is `"next"`.
  - `imageUrl` (3:2) points to the social preview image.
  - `button.title` is the CTA label.
  - `button.action.type` is `launch_frame`.
  - `button.action.name` labels the action.
  - `button.action.url` is the home URL.
  - `splashImageUrl` + `splashBackgroundColor` are set for the miniapp launch screen.
- Miniapp definition fields:
  - `version` is `"1"`.
  - `name`, `iconUrl`, and `homeUrl`.
  - `imageUrl` + `buttonTitle`.
  - `splashImageUrl` + `splashBackgroundColor`.
