# Technical Review — CubixlesBuilderMinter

## Scope
This document covers the onchain builder minting stack implemented by `CubixlesBuilderMinter` and its per-mint royalty receiver `BuilderRoyaltyForwarder`. It focuses on state, mint mechanics, pricing, payout flows, and security-relevant behavior.

## Contract identity
- Contract: `contracts/src/builders/CubixlesBuilderMinter.sol`
- Inheritance: `ERC721`, `ERC2981`, `Ownable`, `ReentrancyGuard`, `EIP712`
- Primary purpose: mint ERC-721 cubes that reference external NFTs, price them via signed floor quotes, and set per-token resale royalties to a forwarder owned by the minter.

## Data model

### Structs
- `NftRef { address contractAddress; uint256 tokenId; }`
  - Represents one referenced NFT.
- `BuilderQuote { uint256 totalFloorWei; uint256 chainId; uint256 expiresAt; uint256 nonce; }`
  - Signed quote produced offchain and verified via EIP-712.

### Core storage
- `totalMinted`: sequential counter used to assign token IDs.
- `mintPriceByTokenId[tokenId]`: mint price snapshot for analytics/UI.
- `metadataHashByTokenId[tokenId]`: keccak256 hash of the pinned metadata payload.
- `quoteSigner`: EOA/contract that signs EIP-712 builder quotes.
- `royaltyForwarderImpl`: implementation address used by `Clones` for per-mint forwarders.
- `pendingOwnerBalance`: accrual bucket when owner payouts fail.
- `_baseTokenURI` and `_tokenUriByTokenId`: optional token URI override.
- `_refsByTokenId[tokenId]`: list of references stored per mint.
- `_floorsByTokenId[tokenId]`: floor snapshots stored per mint.
- `royaltyForwarderByTokenId[tokenId]`: deployed per-mint forwarder address.
- `usedNonces[nonce]`: anti-replay guard for signed quotes.

### Constants
- `MIN_FLOOR_WEI`: minimum floor value applied when a face floor is missing or zero.
- `PRICE_BPS`: builder price factor (10%).
- `BUILDER_BPS`: per-face payout factor (12%).
- `RESALE_ROYALTY_BPS`: ERC-2981 resale royalty for builder tokens (10%).
- `BPS`: basis points denominator (10_000).
- `MAX_REFERENCES`: upper bound on faces (6).
- `REF_TYPEHASH` and `QUOTE_TYPEHASH`: EIP-712 type hashes.

## Mint mechanics

### `mintBuilders`
Inputs: `refs`, `floorsWei`, `quote`, `signature`.

Flow:
1. Validates reference count and floors array length.
2. Computes `expectedTotalFloorWei` by summing floors (zero floors become `MIN_FLOOR_WEI`) and adding `MIN_FLOOR_WEI` for any missing faces.
3. Verifies the EIP-712 quote (signer, chainId, expiry, nonce, total floor).
4. Requires exact `msg.value` equal to the derived mint price (10% of total floor).
5. Resolves royalty receivers for each referenced NFT (ERC-2981) and confirms the minter owns every reference (ERC-721 `ownerOf`).
6. Mints the ERC-721, stores refs + floor snapshots, and distributes payouts.
7. Emits `BuilderMinted`.

### `mintBuildersWithMetadata`
Inputs: `refs`, `floorsWei`, `quote`, `signature`, `tokenUri`, `metadataHash`, `expectedTokenId`.

Additional constraints:
- `tokenUri` must be non-empty.
- `metadataHash` must be non-zero.
- `expectedTokenId` must match `totalMinted + 1` to prevent mismatches during concurrent mints.

Otherwise the flow matches `mintBuilders`, with the addition of `tokenURI` and metadata hash persistence.

## Quote verification
- Uses `EIP712` domain name `CubixlesBuilderMinter` with version `1`.
- Hash includes: `refsHash`, `floorsHash`, `totalFloorWei`, `chainId`, `expiresAt`, `nonce`.
- `refsHash` is a keccak256 over `NftRef` hashes in user-provided order (no canonical sort).
- `floorsHash` is keccak256 over the ABI-packed floors array.
- `usedNonces` prevents reuse across all quotes on the contract.

## Pricing and floor math
- Total floor includes:
  - Sum of each floor (zero is treated as `MIN_FLOOR_WEI`).
  - A `MIN_FLOOR_WEI` pad for each missing face up to `MAX_REFERENCES`.
- Mint price is `totalFloorWei * PRICE_BPS / BPS` (10% of total floor).

## Reference validation
- Each referenced NFT must support `IERC721` and `IERC2981`.
- The minter must be the current owner of every referenced token.
- `royaltyInfo` must return a non-zero receiver; the royalty amount returned is ignored (receiver address only).

## Royalty forwarder per mint
- `_configureRoyalty` clones `royaltyForwarderImpl` and calls `initialize(minter)`.
- The clone is stored in `royaltyForwarderByTokenId` and used as the ERC-2981 receiver.
- Resale royalty rate is fixed at `RESALE_ROYALTY_BPS` (10%).

## Payout distribution
- Each referenced NFT with a non-zero floor receives `share = mintPrice * BUILDER_BPS / BPS`.
- Failed sends are credited to `pendingOwnerBalance` and can be withdrawn by the contract owner.
- Any unassigned remainder (including skipped faces) is credited to the owner.

## Metadata and token URI handling
- `tokenURI` returns the per-token override if set; otherwise it falls back to the ERC-721 base URI.
- `metadataHashByTokenId` stores the keccak256 hash of the pinned metadata JSON.
- `getTokenRefs` and `getTokenFloors` expose the stored snapshot arrays.

## Admin surface
- `setQuoteSigner(address)` updates the EIP-712 quote signer (non-zero required).
- `setRoyaltyForwarderImpl(address)` updates the forwarder implementation (non-zero required).
- `setBaseURI(string)` updates the base URI used by ERC-721.
- `withdrawOwnerBalance(address)` withdraws `pendingOwnerBalance` to a recipient.

## Events
- `BuilderMinted(tokenId, minter, refCount, mintPrice)`.
- `BuilderPayout(receiver, amount, fallbackToOwner)`.
- `BuilderRoyaltyForwarderDeployed(tokenId, minter, forwarder)`.
- `QuoteSignerUpdated`, `RoyaltyForwarderUpdated`, `OwnerBalanceAccrued`, `OwnerBalanceWithdrawn`.

## BuilderRoyaltyForwarder
- Contract: `contracts/src/royalties/BuilderRoyaltyForwarder.sol`.
- Owner is set on `initialize(minter)` and controls split configuration.
- `setSplits(recipients, bps)` enforces equal array lengths and total bps <= 10_000.
- ETH received is distributed per split; remainder goes to owner.
- Failed ETH sends are credited to `pending[recipient]`, withdrawable via `withdrawPending()`.
- `sweepToken` allows the owner to recover ERC-20 tokens sent to the forwarder.

## Security considerations
- Non-reentrancy guards protect mint entry points and forwarder payout paths.
- External calls to referenced NFTs are treated as untrusted and may revert the mint.
- Quote signing is centralized; leakage of the signing key allows malicious price quotes.
- Floor-based pricing depends on offchain oracles and should be monitored for anomalies.
