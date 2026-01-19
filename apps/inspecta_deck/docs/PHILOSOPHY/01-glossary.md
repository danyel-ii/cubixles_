# Glossary

## Reference blocks
- `provenance`: metadata object (root or `metadata.properties`) that carries citations.
- `refsFaces`: array of face reference records in visual order for the cube UI.
- `refsCanonical`: array of face reference records in deterministic order `+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`.
- `refs_faces` / `refs_canonical`: snake_case aliases of `refsFaces` / `refsCanonical`.
- `refs` / `nfts`: generic arrays of reference entries when specific keys are absent.
- `references`: generic list of citations (label + url).
- `provenanceNote`: short narrative string about the cube's lineage.
- `provenanceTrail`: ordered steps; each step includes a title, detail, and optional reference.

## Media fields
- `image` / `image_url` / `image_uri`: static preview asset.
- `animation_url` / `animation_uri`: interactive or video asset, preferred for live experiences.

## Identity fields
- `tokenId`: token identifier, normalized to a base-10 string for lookup/display.
- `contractAddress` / `contract_address` / `address`: NFT contract address.
- `chainId`: numeric chain id.
- `tokenUri` / `metadataUrl`: pointer to the metadata JSON.

## Snapshot fields
- `collectionFloorEth` / `collection_floor_eth`: floor snapshot captured alongside provenance.
- `collectionFloorRetrievedAt` / `collection_floor_retrieved_at`: timestamp for the floor snapshot.
