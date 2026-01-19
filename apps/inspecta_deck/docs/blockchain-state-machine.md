# Blockchain Interaction State Machine

This diagram summarizes the state flow for on-chain and Alchemy-backed reads used by
the landing site and token inspector.

```mermaid
stateDiagram-v2
  [*] --> HTTP_Request

  HTTP_Request --> TokenList
  HTTP_Request --> TokenInspector
  HTTP_Request --> Provenance
  HTTP_Request --> Verify
  HTTP_Request --> MintedCubeViewer

  state "Token list API (/api/poc/tokens)" as TokenList {
    [*] --> RateLimit_OK
    RateLimit_OK --> CacheCheck
    CacheCheck --> Return : cache hit
    CacheCheck --> Alchemy_Collection_Fetch : cache miss
    Alchemy_Collection_Fetch --> Return
    Return --> [*]
  }

  state "Token inspector API (/api/token/:id)" as TokenInspector {
    [*] --> RateLimit_OK
    RateLimit_OK --> Alchemy_Metadata_Fetch
    Alchemy_Metadata_Fetch --> Return
    Return --> [*]
  }

  state "Provenance API (/api/token/:id/provenance)" as Provenance {
    [*] --> RateLimit_OK
    RateLimit_OK --> CacheCheck
    CacheCheck --> Return : cache hit
    CacheCheck --> Alchemy_Metadata_Fetch : cache miss
    Alchemy_Metadata_Fetch --> Receipt_Lookup : if mint tx hash
    Alchemy_Metadata_Fetch --> Owner_Lookups : if no mint tx hash
    Receipt_Lookup --> Owner_Lookups
    Owner_Lookups --> Build_Candidates
    Build_Candidates --> Return
    Return --> [*]
  }

  state "Verify API (/api/token/:id/verify)" as Verify {
    [*] --> RateLimit_OK
    RateLimit_OK --> RPC_ownerOf_tokenURI
    RPC_ownerOf_tokenURI --> Return
    Return --> [*]
  }

  state "Minted cube viewer (getLiveMintedCube)" as MintedCubeViewer {
    [*] --> CacheCheck
    CacheCheck --> Return : cache hit
    CacheCheck --> RPC_MintTransfers : cache miss
    RPC_MintTransfers --> Alchemy_Cube_Metadata
    Alchemy_Cube_Metadata --> Merge_Hydrate
    Merge_Hydrate --> Alchemy_External_Metadata
    Alchemy_External_Metadata --> Return
    Return --> [*]
  }
```

Sources:
- Token list + Alchemy collection fetch: `app/api/poc/tokens/route.ts`, `app/_lib/alchemy.ts`
- Token inspector metadata: `app/api/token/[id]/route.ts`, `app/_lib/alchemy.ts`
- Provenance (receipt parsing + owners lookup): `app/api/token/[id]/provenance/route.ts`, `app/_lib/ethers.ts`, `app/_lib/alchemy.ts`
- Verify (ownerOf/tokenURI): `app/api/token/[id]/verify/route.ts`, `app/_lib/ethers.ts`
- Minted cube viewer (mint transfers + metadata + external metadata): `app/_lib/mintedCubeService.ts`
