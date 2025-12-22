# IceCube Farcaster Miniapp Task Log

## Status Legend
- Done
- In Progress
- Open
- Blocked

## Task Tracking

| Task | Status | Notes |
| --- | --- | --- |
| T2 — Bundler scaffolding + ES modules | Done | Vite scaffold + ES modules verified in dev. |
| T3 — Wallet provider integration | Done | Added Farcaster SDK wallet connect/disconnect UI + state. |
| T4 — Manifest capabilities | Done | Added `/.well-known/farcaster.json` with required capabilities and chains (placeholders for association + URLs). |
| T5 — Spec shapes | Open | Needs `NftItem` + `ProvenanceBundle` definitions. |
| T6 — Alchemy inventory | Open | Implement `getNFTsForOwner`. |
| T7 — Alchemy provenance | Open | Implement `getNFTMetadata` for token URI + image. |
| T8 — NFT picker UI | Open | Selection UI for exactly 3. |
| T9 — Face mapping rules | Open | Define in spec doc. |
| T10 — Cube textures from provenance | Open | Wire metadata images into cube. |
| T11 — Contract spec | Open | Ownership-gated mint design. |
| T12 — Metadata builder | Open | Embed provenance bundle in tokenURI JSON. |
| T13 — Storage decision | Open | Decide where metadata/image live. |
| T14 — Direct mint call | Open | Mint flow via wallet provider. |
