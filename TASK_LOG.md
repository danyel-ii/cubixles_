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
| T5 — Spec shapes | Done | Added `docs/B-app/20-spec.md` and `src/types/provenance.ts`. |
| T6 — Alchemy inventory | Done | Added Alchemy client + indexer with Sepolia gating and SAFE-INT checks. |
| T7 — Alchemy provenance | Done | Added provenance fetch + bundle builder with raw metadata + URI normalization. |
| T8 — NFT picker UI | Done | Wallet-driven picker with 1–6 selection limit. |
| T9 — Face mapping rules | Done | Fixed +X,-X,+Y,-Y,+Z,-Z order + frosted fallback. |
| T10 — Cube textures from provenance | In Progress | Apply selection textures with caching + downscale. |
| T11 — Contract spec | In Progress | IceCubeMinter contract + tests for 1–6 refs (forge test: 8 pass, 2025-12-23). |
| T12 — Metadata builder | In Progress | Mint UI builds JSON data URI with provenance. |
| T13 — Storage decision | Open | Decide where metadata/image live. |
| T14 — Direct mint call | In Progress | Mint UI added; awaiting deployed contract + ABI. |
