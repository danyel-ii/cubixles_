# Alchemy integration

This app uses the Alchemy NFT REST API for collection and metadata lookups, and the Alchemy RPC endpoint (via ethers.js) for read-only transaction and contract calls.

## Base URLs
- NFT API (v3): `https://{NETWORK}.g.alchemy.com/nft/v3/{ALCHEMY_KEY_OR_API_KEY}`
- NFT API (mint audit, v2): `https://{NETWORK}.g.alchemy.com/nft/v2/{ALCHEMY_API_KEY}`
- RPC: `https://{NETWORK}.g.alchemy.com/v2/{ALCHEMY_KEY_OR_API_KEY}`
Note: v3 + RPC use whichever of `ALCHEMY_KEY` or `ALCHEMY_API_KEY` is set first.

## Network resolution
- Primary: `NETWORK`.
- Fallback: `CUBIXLES_CHAIN_ID` or `BASE_CHAIN_ID` mapped to Alchemy network IDs.
- Mint audit (v2) uses `CUBIXLES_CHAIN_ID` to select the base URL.

## NFT REST endpoints used
- `GET /getNFTsForCollection?contractAddress=...&withMetadata=true&limit=...`
  - Accepts `pageKey` for pagination; responses include `pageKey` when more results remain.
  - Fetches collection tokens for `/api/poc/tokens`.
- `GET /getNFTMetadata?contractAddress=...&tokenId=...`
  - Fetches token metadata and mint details for `/api/token/:id`.
- `GET /getOwnersForNFT?contractAddress=...&tokenId=...`
  - Fetches current owners for provenance owner overlap checks.
- Mint audit enrichment uses `getNFTMetadata` via the v2 endpoint (uses `ALCHEMY_API_KEY`, `CUBIXLES_CHAIN_ID`, and `CUBIXLES_CONTRACT_ADDRESS`).

## RPC methods used (read-only)
- `eth_getTransactionReceipt`
  - Reads mint transaction logs to infer tokens minted in the same transaction.
- `eth_call`
  - Reads `ownerOf` and `tokenURI` in `/api/token/:id/verify`.
- `alchemy_getAssetTransfers`
  - Optional mint audit enrichment (requires `MAINNET_RPC_URL` and `CUBIXLES_CONTRACT_ADDRESS`, mainnet only).

## API response notes
### `/api/token/:id/provenance`
Response includes the `candidates` list plus:
- `tokenId`, `contractAddress`, `network`
- `mintTxHash`
- `metadataReferenceCount`, `sameTransactionCount`, `ownerOverlapCount`
- `disclaimer` (heuristic provenance warning)
