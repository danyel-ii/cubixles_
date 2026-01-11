# cubixles_ v0 — Test Plan

Last updated: 2026-01-10

## Review Status

- Last reviewed: 2026-01-10
- Review status: Updated
- Owner: danyel-ii

This plan defines the tests needed to trust the system end-to-end:
- Interactive p5-based NFT (`external_url`)
- Provenance refs (1–6 NFTs)
- Economics (dynamic mint price + ERC-2981 resale royalties)
- Per-mint tokenURI pinning + palette manifest commitment
- Farcaster miniapp wallet connect + mint UX

## 0) Definitions & invariants (shared across all tests)

### Core invariants
1. **Ownership gating**: mint must fail unless `msg.sender` owns every referenced NFT.
2. **Ref count**: `refs.length` in `[1..6]`.
3. **TokenURI correctness**: pinned tokenURI points to metadata JSON that:
   - resolves via `ipfs://<metadataCid>`
   - includes palette traits + image + provenance
   - uses the expected palette index for the image filename
4. **Economics**:
   - mint requires `msg.value >= currentMintPrice()`
   - mint pays `currentMintPrice()` to RoyaltySplitter and refunds any overpayment
   - `currentMintPrice()` is rounded up to the nearest `0.0001 ETH`
   - on Base (LESS disabled), `currentMintPrice()` is linear (`base + step * totalMinted`) and LESS metrics are `0`
   - ERC-2981 resale royalties route to RoyaltySplitter (bps = 500)
5. **Resale royalties (ERC-2981)**:
   - `royaltyInfo(tokenId, salePrice)` returns the **splitter** as receiver
   - bps matches configured value
6. **Onchain tokenURI**:
   - mint stores `tokenURI` provided by the minter (non-empty)
   - mint reverts if `expectedPaletteIndex` does not match the drawn palette index

## 1) Contract tests (Foundry) — required

**Tooling:** Foundry (`forge test`)  
**Goal:** Prove correctness of gating + economics + ERC-2981 behavior.

### 1.1 Unit tests (deterministic)
**A. Reference count guards**
- mint reverts if `refs.length == 0`
- mint reverts if `refs.length > 6`

**B. Ownership gating**
- mint reverts if any ref is not owned by `msg.sender`
- mint succeeds when all refs owned

**C. TokenURI storage**
- tokenURI resolves to pinned metadata (`ipfs://<metadataCid>`)
- tokenURI metadata includes palette traits + provenance
- tokenId is deterministic and unique per (minter, salt, refs)

**C2. Deterministic tokenId**
- `previewTokenId(salt, refs)` matches the minted tokenId
- mint reverts on replay with the same salt + refs

**C3. Commit guards**
- mint reverts without a prior commit
- mint reverts if commit is in the same block
- mint reverts if commit expires (>256 blocks)
- mint reverts on refsHash or salt mismatch
- mint reverts if reveal block is not yet available
- mint reverts if metadata is not committed or metadata hashes mismatch
- commitMint reverts on empty hash or active commit

**D. Payment requirements**
- mint reverts if `msg.value < currentMintPrice()`
- mint succeeds if `msg.value == currentMintPrice()`
- mint succeeds if `msg.value > currentMintPrice()` and refunds delta

**E. RoyaltySplitter behavior**
- when swap disabled → forwards 100% ETH to owner
- when swap reverts → forwards 100% ETH to owner (does not revert)
- when swap succeeds → sends 25% ETH to owner, swaps 25% to $LESS (owner), swaps 50% to $PNKSTR (owner), and forwards any remaining ETH to owner

**F. ERC-2981 resale royalty**
- `royaltyInfo(ourTokenId, salePrice)` returns `(splitter, expectedAmount)`
- updating resale royalty receiver/bps (owner-only) behaves correctly

### 1.2 Edge & adversarial tests (still deterministic)
**G. Receiver failure behavior**
- If a receiver is a contract that reverts on receive:
  - mint reverts because the RoyaltySplitter payout fails
  - RoyaltySplitter reverts on failed ETH or token transfers

**H. Rounding**
- `currentMintPrice()` is rounded up to the nearest `0.0001 ETH`.
- Assert boundary cases (exact step, just under step, zero).

**I. Reentrancy**
- If your mint does external calls (ETH sends), add:
  - test with a malicious receiver contract attempting reentrancy
  - expected: mint is safe (either via checks-effects-interactions or guard)

### 1.3 Fuzz/property tests (high value)
Use Foundry fuzzing to generate:
- refs length in [1..6]
- mix of ERC-2981 vs non-2981 referenced NFTs
- msg.value around boundary (below/at/above required)
- salePrice for `royaltyInfo` queries

**Properties to assert**
- (P1) If any ref not owned -> revert
- (P2) If `msg.value < required` -> revert
- (P3) If mint succeeds: balances change satisfy split invariants and refund invariant
- (P4) `royaltyInfo` receiver always equals splitter

### Contract test “Definition of done”
- `forge test` passes
- Coverage includes economics + refund (not just gating)
- Coverage report generated with ≥ 90% line coverage (`npm run coverage:contracts`)

## 2) Serverless tests (Vercel endpoints for Pinata) — optional (offchain metadata)

**Goal:** Ensure the upload pipeline is correct, stable, and never leaks secrets (used only for optional metadata pinning).

### 2.1 Unit tests (mock Pinata)
For `/api/pin/metadata`:
- accepts `{ address, nonce, signature, payload }`
- validates metadata schema (`name` required, `provenance` present) and requires 1..6 provenance refs
- rejects invalid nonce/signature with `401`
- returns `{ cid, tokenURI }` and caches by payload hash
- rejects malformed JSON

For `/api/nonce`:
- returns a stateless HMAC-signed nonce and `expiresAt`

For `/api/nfts`:
- accepts allowlisted Alchemy NFT paths (`getNFTsForOwner`, `getNFTMetadata`, `getFloorPrice`)
- accepts `mode=rpc` batch `eth_call` requests
- caches responses and returns minimized payloads

For `/api/identity`:
- returns `{ address, farcaster, ens }` with `farcaster`/`ens` null when unavailable
- includes Farcaster `fid`, `username`, and `url` when the Neynar API key is configured

**Security tests**
- endpoint does not echo secrets in response/logs
- CORS policy as intended (either restricted or explicit)

### 2.2 Integration smoke test (against real Pinata, manual)
- POST a small PNG -> confirm CID resolves via gateway
- POST metadata JSON referencing that CID + `external_url` -> confirm JSON resolves via gateway

## 3) Frontend tests (miniapp) — required

### 3.1 Pure logic unit tests
**Provenance builder**
- builds bundle for 1..6 selections
- includes contractAddress checksum formatting
- tokenId SAFE-INT policy applied to `tokenIdNumber` (null if > MAX_SAFE_INTEGER)
- stores `{original, resolved}` for tokenUri and image
- raw metadata JSON stored (“gamut”)

**URI resolver**
- `ipfs://` -> gateway https
- arweave https preserved
- rejects unsupported schemes or marks as “unrenderable”

**Face mapping**
- deterministic mapping from selection order -> cube faces
- correct behavior when <6 (frosted/blank/repeat per spec)

### 3.2 UI behavior tests (component/integration)
- selection constrained to 1..6
- mint button disabled until:
  - wallet connected
  - selection count is 1..6
  - contract address + ABI are present
- mint action blocks and shows an error if the read provider reports a different chain than the active chain
- floor snapshot computed for current selection (cached per contract)
- mint payment autofill matches `currentMintPrice()`
- mint flow shows three wallet prompts (commit, metadata, mint) when no active commit exists
- floor snapshot UI shows per-NFT and total floor values
- floor snapshot defaults to `0` when unavailable
- ΔLESS HUD shows delta when tokenId is known (mainnet only)
- Leaderboard ranks tokens by ΔLESS and returns to main UI (mainnet only)
- On Base, LESS metrics are disabled and the mint price note shows linear pricing

### 3.3 Automated smoke (Playwright)
- Load `/` and assert overlay + UI controls render.
- Use `npm run test:ui` (Playwright) for a minimal regression signal.

## 4) End-to-end tests — required (at least one “golden path”)

Because Warpcast hosting is hard to automate, we split E2E into:

### 4.1 Automated E2E (local / CI) using a stub provider
- Run app with a mocked EIP-1193 provider (simulates wallet)
- Stub Alchemy responses (owned NFTs + metadata)
- (Optional) Stub Pinata endpoints if testing `/api/pin/metadata`
- Stub contract calls (or run local Anvil with deployed contract)
  - Playwright mocked flows live under `tests/e2e/`.

**Assertions**
- connect -> inventory renders
- select refs -> cube textures update
- click mint -> app commits then commits metadata then mints with:
  - commit tx sent first, metadata commit after reveal block, mint tx after metadata confirmation
  - `refs` encoded correctly
  - `value` set to max payment
- success state displayed

### 4.2 Manual E2E (release gate) inside Warpcast on mainnet
This is the “ship gate” checklist:

1. Open miniapp in Warpcast
2. Connect wallet
3. Ensure network = mainnet
4. Select 1..6 NFTs (owned on mainnet)
5. Mint:
  - wait for reveal block between commit + metadata + mint
   - wallet shows tx with correct `value`
6. Confirm onchain:
   - transaction success
   - tokenURI resolves to pinned metadata (`ipfs://<metadataCid>`)
   - resale royalty points to splitter
   - balances reflect mint-time splits + refund
7. Open `https://<domain>/m/<tokenId>` and verify the cube loads with the correct refs.

## 5) Observability / debugging hooks (recommended)
Not tests, but they reduce time-to-fix:

- Log the computed economics breakdown before calling mint:
  - required total, pot, per-slice amounts, expected refund
- Log the final URIs:
  - `imageIpfsUri`, `metaIpfsUri`, `external_url`
- Expose a “copy diagnostics” button (dev-only)

## 6) Commands / what to run
- Contract: `forge test`
- Unit/API: `npm test` (Vitest)
- Frontend: `npm run test:ui` (Playwright smoke)
- Manual: Warpcast E2E gate (see 4.2)

## 7) Minimum acceptance threshold for v0
We do not ship unless:
- Contract unit tests + fuzz tests pass
- Pinning endpoints pass unit tests and one real Pinata smoke test
- Manual Warpcast mainnet E2E mint succeeds twice (two different selections)
