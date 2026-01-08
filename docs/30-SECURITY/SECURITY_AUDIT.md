# cubixles_ — Security & Edge-Case Coverage Implementation Results

Last updated: 2026-01-08
Date: 2026-01-08
Run timestamp (local): 2026-01-08T14:48:09Z (app-only audit)
Previous full scan: 2026-01-08T12:20:11Z

## Scope
- Contracts: `CubixlesMinter`, `RoyaltySplitter`
- Tests: unit, fuzz, invariants, edge cases, fork harness
- Tooling: Slither + Solhint configs, CI workflow, client secret scan

## Implemented artifacts
- Docs: `docs/30-SECURITY/THREAT_MODEL.md`, `docs/30-SECURITY/INVARIANTS.md`, `docs/30-SECURITY/KNOWN_LIMITATIONS.md`, `docs/30-SECURITY/STATIC_ANALYSIS.md`, `docs/30-SECURITY/SECURITY_RUNBOOK.md`, `docs/30-SECURITY/FORK_TESTING.md`
- CI: `.github/workflows/ci.yml`
- Static analysis config: `contracts/.solhint.json`, `contracts/slither.config.json`
- Mocks: `contracts/test/mocks/MockERC721s.sol`, `contracts/test/mocks/Receivers.sol`
- Edge tests: `contracts/test/CubixlesMinterEdge.t.sol`, updates to `contracts/test/RoyaltySplitter.t.sol`
- Fuzz tests: `contracts/test/fuzz/CubixlesMinterFuzz.t.sol`
- Invariants: `contracts/test/invariants/CubixlesMinterInvariants.t.sol`
- Fork tests: `contracts/test/fork/MainnetFork.t.sol`, `contracts/test/fork/BaseFork.t.sol`
- Endpoint hardening: nonce + signature auth, rate limits, Zod validation, size caps, safe logging
- CSP telemetry: `middleware.js`, `app/api/csp-report/route.js`
- Client secret scan: `scripts/check-client-secrets.mjs`
- Repo secret scan: `scripts/check-repo-secrets.mjs`

## Policy decisions captured
- Receiver failure policy is strict: mint/royalty transfers revert on failed ETH or token transfer.
- `ownerOf` revert or mismatch causes mint revert.
- Refund exactness: `msg.value - currentMintPrice()` is returned to minter.
- RoyaltySplitter sends 50% ETH to owner, swaps 50% to $LESS, then sends 90% $LESS to owner and 10% to burn.

## Test results
### App security audit (no contract scans)
Run timestamp (local): 2026-01-08T14:48:09Z
- `npm test` — PASS (22 tests)
- `npm run test:ui` — PASS (3 tests)
- `npm run check:no-client-secrets` — PASS
- `npm run check:no-repo-secrets` — PASS
- `npm audit --audit-level=high` — PASS (0 vulnerabilities)
Notes:
- Contract-focused scans (`forge test`, `coverage:contracts`, `solhint`, `slither`, fork tests) were not run for this app-only audit.

### Unit + edge + fuzz + invariants
Command:
```sh
cd contracts
forge test -vvv
```
Result: PASS (96 tests; fork tests logged as skipped because RPC env vars were not set).

### Coverage (Solidity)
Command:
```sh
npm run coverage:contracts
```
Result: PASS (92.79% line coverage; minimum is 90%).
- Report: `docs/50-REPORTS/COVERAGE_REPORT.md` (grouped by contract).
- Excluded: `contracts/script/**` from the coverage gate.
- Action: keep coverage at or above 90% before mainnet release.
Warnings during coverage:
- Low-level call return values ignored in test helpers (`RoyaltySplitter.t.sol`).
- Some test functions could be marked `view` (test-only warnings).
- Foundry coverage anchors missing for a few lines in test/mocks (informational).

### Invariants (via `forge test -vvv`)
Result: PASS (3 tests, 128k handler calls; included in the full forge run).

### Fork tests (mainnet)
Command:
```sh
export MAINNET_RPC_URL="https://your-mainnet-rpc"
export FORK_BLOCK_NUMBER=19000000
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
npm run fork-test
```
Result: PASS (2 tests; latest local run 2026-01-08 with `MAINNET_RPC_URL` set)
- `ownerOf` reverted (non-standard or restricted), logged and allowed.
- `royaltyInfo` reverted (non-ERC2981 or restricted), logged and allowed.
- Forge traces emitted Sourcify decode warnings (non-blocking).

### Fork tests (Base)
Command:
```sh
export BASE_RPC_URL="https://your-base-rpc"
export BASE_FORK_BLOCK=30919316
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
npm run fork-test
```
Result: PASS (1 test; latest local run 2026-01-08 with `BASE_RPC_URL` set)
- Chain id and fork block assertions passed (connectivity confirmed). Optional `BASE_FORK_TEST_ADDRESS` check runs only when set.

### Frontend tests
Command:
```sh
npm test
```
Result: PASS (22 tests, Vitest unit/component/API; v4.0.16).

### Frontend smoke (Playwright)
Command:
```sh
npm run test:ui
```
Result: PASS (3 tests, ~9s)

### Client secret scan
Command:
```sh
npm run check:no-client-secrets
```
Result: PASS (no forbidden strings in the client bundle).

### Repo secret scan
Command:
```sh
npm run check:no-repo-secrets
```
Result: PASS (no forbidden secrets in the repo).

### npm audit
Command:
```sh
npm audit --audit-level=high
```
Result: PASS (0 vulnerabilities).

### Abuse checks (pin endpoint)
Command:
```sh
npm run dev -- --port 3010
```
Results (local):
- Size cap: `POST /api/pin/metadata` with ~50KB body → `413 Payload too large`.
- Rate limit: 5 requests in quick succession → `429 Rate limit exceeded` on the 6th request (capacity 5, refill 0.5/sec).
- Invalid payloads return `400` before signature checks as expected.

## Static analysis
- Local solhint run:
  - Command: `cd contracts && npx solhint "src/**/*.sol"`
  - Result: 0 errors, 0 warnings; latest local run 2026-01-08.
- Local slither run (venv):
  - Command: `cd contracts && ../.venv-slither/bin/python -m slither .`
  - Result: 0 project findings (latest local run 2026-01-08); `naming-convention` excluded in config.
  - Dependency noise: OpenZeppelin + Uniswap v4 math/assembly/pragma warnings.

## Formal verification
No formal verification has been performed. The current posture is unit/fuzz/invariant coverage
plus fork checks and manual review; formal proofs are a pending work item.

## Attack-surface review (manual)
- `_safeMint` is the only external callback path in mint; state is committed before it to reduce reentrancy risk.
- External `ownerOf`/`royaltyInfo` calls are treated as untrusted and are allowed to revert.
- Royalty swap path depends on PoolManager liquidity and hook behavior; failures fall back to forwarding ETH to the owner.
- Base linear pricing is immutable once deployed; misconfiguration requires redeploy.

## Notes
- Fork tests are optional; they skip unless `MAINNET_RPC_URL` or `BASE_RPC_URL` is provided.
- Release gate uses `npm run fork-test` with a pinned block via `FORK_BLOCK_NUMBER` or `BASE_FORK_BLOCK`.
- CI includes `forge test`, `npm test`, `npm run test:ui`, `solhint`, `slither`, coverage (90% minimum),
  `npm audit --audit-level=high`, `npm run check:no-client-secrets`, and `npm run check:no-repo-secrets`.
- Local `npm audit --audit-level=high` (2026-01-08): 0 vulnerabilities.
