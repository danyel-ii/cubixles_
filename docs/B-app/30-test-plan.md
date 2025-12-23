# cubeless v0 — Test Plan

## Review Status

- Last reviewed: 2025-12-23
- Review status: Needs confirmation
- Owner: TBD

This plan defines the tests needed to trust the system end-to-end:
- Interactive p5-based NFT (`animation_url`)
- Provenance refs (1–6 NFTs)
- Economics (fixed mint price + mint-time royalty routing)
- Hosted tokenURI (IPFS via Pinata + Vercel endpoints)
- Farcaster miniapp wallet connect + mint UX

## 0) Definitions & invariants (shared across all tests)

### Core invariants
1. **Ownership gating**: mint must fail unless `msg.sender` owns every referenced NFT.
2. **Ref count**: `refs.length` in `[1..6]`.
3. **TokenURI correctness**: stored tokenURI points to metadata JSON that:
   - includes provenance bundle (refs + full metadata gamut)
   - includes `animation_url` to IPFS-hosted HTML (the p5 work)
   - optionally includes `image` thumbnail (static) for wallets/markets
4. **Economics**:
   - mint requires at least `BASE_MINT_PRICE + MINT_ROYALTY_TOPUP`
   - the “royalty pot” is split:
     - 60% / N across **referenced NFTs that implement ERC-2981** (skip those without 2981)
     - 20% creator
     - 20% $Less placeholder
   - **refund overpayment** (contract returns any excess ETH to minter)
5. **Resale royalties (ERC-2981)**:
   - `royaltyInfo(tokenId, salePrice)` returns the **splitter** as receiver
   - bps matches configured value
6. **Hosted tokenURI**:
   - pin image -> `ipfs://<imageCID>`
   - pin metadata (with `animation_url`) -> `ipfs://<metaCID>`
   - mint uses `tokenURI = ipfs://<metaCID>` (not `data:`)

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
- tokenURI stored equals input string exactly
- tokenId increments / uniqueness

**D. Payment requirements**
- mint reverts if `msg.value < requiredTotal`
- mint succeeds if `msg.value == requiredTotal`
- mint succeeds if `msg.value > requiredTotal` and refunds delta

**E. Mint-time splits**
Given N references where `k` implement ERC-2981 (k may be 0):
- creator receives exactly 20% of mint-time royalty pot (define pot precisely)
- less treasury receives exactly 20%
- each ERC-2981 receiver receives exactly `(60% / k)` * pot (if k > 0)
- if k == 0, the “60% slice” is not paid (or is reallocated, depending on spec) — lock expected behavior and assert it
- sum(paidOut) + refund == msg.value (within 1 wei if rounding rules exist)

**F. ERC-2981 resale royalty**
- `royaltyInfo(ourTokenId, salePrice)` returns `(splitter, expectedAmount)`
- updating resale royalty receiver/bps (owner-only) behaves correctly

### 1.2 Edge & adversarial tests (still deterministic)
**G. Receiver failure behavior**
- If a receiver is a contract that reverts on receive:
  - decide expected behavior: revert entire mint OR skip + refund OR redirect
  - write test for the chosen behavior

**H. Rounding**
- If pot splits produce remainders:
  - define rounding rule (floor) + who gets remainder (refund vs treasury)
  - assert it

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

## 2) Serverless tests (Vercel endpoints for Pinata) — required for hosted tokenURI

**Goal:** Ensure the upload pipeline is correct, stable, and never leaks secrets.

### 2.1 Unit tests (mock Pinata)
For `/api/pin-image`:
- accepts PNG upload (multipart or base64 — whichever we implement)
- forwards bytes to Pinata with Authorization header (server-side only)
- returns `{ ipfsUri, gatewayUrl }`
- rejects invalid content types
- enforces max size (to prevent abuse)

For `/api/pin-metadata`:
- accepts metadata JSON
- validates required fields exist (`name`, `animation_url`, `provenance`, `schemaVersion`)
- returns `{ ipfsUri, gatewayUrl }`
- rejects malformed JSON

**Security tests**
- endpoint does not echo secrets in response/logs
- CORS policy as intended (either restricted or explicit)

### 2.2 Integration smoke test (against real Pinata, manual)
- POST a small PNG -> confirm CID resolves via gateway
- POST metadata JSON referencing that CID + `animation_url` -> confirm JSON resolves via gateway

## 3) Frontend tests (miniapp) — required

### 3.1 Pure logic unit tests
**Provenance builder**
- builds bundle for 1..6 selections
- includes contractAddress checksum formatting
- tokenId SAFE-INT policy enforced (block unsafe)
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
  - on Sepolia
  - provenance fetched
  - pinning succeeded (if option B)
- “max payment” autofill matches economics formula

## 4) End-to-end tests — required (at least one “golden path”)

Because Warpcast hosting is hard to automate, we split E2E into:

### 4.1 Automated E2E (local / CI) using a stub provider
- Run app with a mocked EIP-1193 provider (simulates wallet)
- Stub Alchemy responses (owned NFTs + metadata)
- Stub Pinata endpoints (return fake CIDs)
- Stub contract calls (or run local Anvil with deployed contract)

**Assertions**
- connect -> inventory renders
- select refs -> cube textures update
- click mint -> app pins metadata -> calls mint with:
  - `tokenURI = ipfs://<metaCID>`
  - `refs` encoded correctly
  - `value` set to max payment
- success state displayed

### 4.2 Manual E2E (release gate) inside Warpcast on Sepolia
This is the “ship gate” checklist:

1. Open miniapp in Warpcast
2. Connect wallet
3. Ensure network = Sepolia
4. Select 1..6 NFTs (owned on Sepolia)
5. Mint:
   - observe two pins (image + metadata) returning ipfs URIs
   - wallet shows tx with correct `value`
6. Confirm onchain:
   - transaction success
   - tokenURI resolves to metadata JSON
   - metadata includes `animation_url` pointing to IPFS-hosted HTML
   - resale royalty points to splitter
   - balances reflect mint-time splits + refund

## 5) Observability / debugging hooks (recommended)
Not tests, but they reduce time-to-fix:

- Log the computed economics breakdown before calling mint:
  - required total, pot, per-slice amounts, expected refund
- Log the final URIs:
  - `imageIpfsUri`, `metaIpfsUri`, `animation_url`
- Expose a “copy diagnostics” button (dev-only)

## 6) Commands / what to run
- Contract: `forge test`
- Frontend: `npm test` (unit) / `npm run test:e2e` (if Playwright)
- Manual: Warpcast E2E gate (see 4.2)

## 7) Minimum acceptance threshold for v0
We do not ship unless:
- Contract unit tests + fuzz tests pass
- Pinning endpoints pass unit tests and one real Pinata smoke test
- Manual Warpcast Sepolia E2E mint succeeds twice (two different selections)
