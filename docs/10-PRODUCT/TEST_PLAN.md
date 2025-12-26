# cubeless v0 — Test Plan

Last updated: 2025-12-26

## Review Status

- Last reviewed: 2025-12-26
- Review status: Needs confirmation
- Owner: TBD

This plan defines the tests needed to trust the system end-to-end:
- Interactive p5-based NFT (`animation_url`)
- Provenance refs (1–6 NFTs)
- Economics (dynamic mint price + ERC-2981 resale royalties)
- Hosted tokenURI (IPFS via Pinata + Vercel endpoints)
- Farcaster miniapp wallet connect + mint UX

## 0) Definitions & invariants (shared across all tests)

### Core invariants
1. **Ownership gating**: mint must fail unless `msg.sender` owns every referenced NFT.
2. **Ref count**: `refs.length` in `[1..6]`.
3. **TokenURI correctness**: stored tokenURI points to metadata JSON that:
   - includes provenance bundle (refs + full metadata gamut)
   - includes `animation_url` pointing to `https://<domain>/m/<tokenId>`
   - includes `image` pointing to the pre-generated GIF thumbnail
   - includes `gif` params + `attributes` traits for wallets/markets
4. **Economics**:
   - mint requires `msg.value >= currentMintPrice()`
   - mint pays `currentMintPrice()` to owner and refunds any overpayment
   - `currentMintPrice()` is rounded up to the nearest `0.0001 ETH`
   - ERC-2981 resale royalties route to RoyaltySplitter (bps = 500)
5. **Resale royalties (ERC-2981)**:
   - `royaltyInfo(tokenId, salePrice)` returns the **splitter** as receiver
   - bps matches configured value
6. **Hosted tokenURI**:
   - pin metadata (with `animation_url` + GIF `image`) -> `ipfs://<metaCID>`
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
- tokenId is deterministic and unique per (minter, salt, refs)

**C2. Deterministic tokenId**
- `previewTokenId(salt, refs)` matches the minted tokenId
- mint reverts on replay with the same salt + refs

**D. Payment requirements**
- mint reverts if `msg.value < currentMintPrice()`
- mint succeeds if `msg.value == currentMintPrice()`
- mint succeeds if `msg.value > currentMintPrice()` and refunds delta

**E. RoyaltySplitter behavior**
- when router unset → forwards 100% ETH to owner
- when swap reverts → forwards 100% ETH to owner (does not revert)
- when swap succeeds → splits $LESS 50% to burn address and 50% to owner, then remaining ETH to owner

**F. ERC-2981 resale royalty**
- `royaltyInfo(ourTokenId, salePrice)` returns `(splitter, expectedAmount)`
- updating resale royalty receiver/bps (owner-only) behaves correctly

### 1.2 Edge & adversarial tests (still deterministic)
**G. Receiver failure behavior**
- If a receiver is a contract that reverts on receive:
  - mint reverts with `EthTransferFailed`
  - RoyaltySplitter reverts with `EthTransferFailed` when forwarding ETH

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

## 2) Serverless tests (Vercel endpoints for Pinata) — required for hosted tokenURI

**Goal:** Ensure the upload pipeline is correct, stable, and never leaks secrets.

### 2.1 Unit tests (mock Pinata)
For `/api/pin/metadata`:
- accepts `{ address, nonce, signature, payload }`
- validates required fields exist (`name`, `animation_url`, `provenance`, `schemaVersion`)
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
- returns Farcaster identity when configured (Neynar API key)
- falls back to ENS or address when unavailable

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
- floor snapshot computed for current selection
  - pinning succeeded (if option B)
- mint payment autofill matches `currentMintPrice()`
- floor snapshot UI shows per-NFT and total floor values
- floor snapshot defaults to `0` on Sepolia
- ΔLESS HUD shows delta when tokenId is known
- Leaderboard ranks tokens by ΔLESS and returns to main UI

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
   - observe metadata pin returning an ipfs URI
   - wallet shows tx with correct `value`
6. Confirm onchain:
   - transaction success
   - tokenURI resolves to metadata JSON
   - metadata includes `animation_url` pointing to `/m/<tokenId>`
   - resale royalty points to splitter
   - balances reflect mint-time splits + refund
7. Open `https://<domain>/m/<tokenId>` and verify the cube loads with the correct refs.

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
