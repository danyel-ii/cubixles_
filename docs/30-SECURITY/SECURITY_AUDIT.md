# cubixles_ — Security & Edge-Case Coverage Implementation Results

Last updated: 2026-01-01
Date: 2026-01-01

## Scope
- Contracts: `IceCubeMinter`, `RoyaltySplitter`
- Tests: unit, fuzz, invariants, edge cases, fork harness
- Tooling: Slither + Solhint configs, CI workflow, client secret scan

## Implemented artifacts
- Docs: `docs/30-SECURITY/THREAT_MODEL.md`, `docs/30-SECURITY/INVARIANTS.md`, `docs/30-SECURITY/KNOWN_LIMITATIONS.md`, `docs/30-SECURITY/STATIC_ANALYSIS.md`, `docs/30-SECURITY/SECURITY_RUNBOOK.md`, `docs/30-SECURITY/FORK_TESTING.md`
- CI: `.github/workflows/ci.yml`
- Static analysis config: `contracts/.solhint.json`, `contracts/slither.config.json`
- Mocks: `contracts/test/mocks/MockERC721s.sol`, `contracts/test/mocks/Receivers.sol`
- Edge tests: `contracts/test/IceCubeMinterEdge.t.sol`, updates to `contracts/test/RoyaltySplitter.t.sol`
- Fuzz tests: `contracts/test/fuzz/IceCubeMinterFuzz.t.sol`
- Invariants: `contracts/test/invariants/IceCubeMinterInvariants.t.sol`
- Fork tests: `contracts/test/fork/MainnetFork.t.sol`
- Endpoint hardening: nonce + signature auth, rate limits, Zod validation, size caps, safe logging
- Client secret scan: `scripts/check-client-secrets.mjs`

## Policy decisions captured
- Receiver failure policy is strict: mint/royalty transfers revert on failed ETH or token transfer.
- `ownerOf` revert or mismatch causes mint revert.
- Refund exactness: `msg.value - currentMintPrice()` is returned to minter.
- RoyaltySplitter sends 50% ETH to owner, swaps 50% to $LESS, then sends 90% $LESS to owner and 10% to burn.

## Test results
### Unit + edge + fuzz + invariants
Command:
```sh
cd contracts
forge test -vvv
```
Result: PASS (89 tests; fork tests skipped in this run because `MAINNET_RPC_URL` was not set).

### Coverage (Solidity)
Command:
```sh
npm run coverage:contracts
```
Result: PASS (98.56% line coverage; minimum is 90%).
- Report: `docs/50-REPORTS/COVERAGE_REPORT.md` (grouped by contract).
- Excluded: `contracts/script/**` from the coverage gate.
- Action: keep coverage at or above 90% before mainnet release.
Warnings during coverage:
- Low-level call return values ignored in test helpers (`RoyaltySplitter.t.sol`).
- Some test functions could be marked `view` (test-only warnings).
- Foundry coverage anchors missing for a few lines in test/mocks (informational).

### Invariants (standalone run)
Command:
```sh
cd contracts
forge test --match-path "test/invariants/*" -vvv
```
Result: PASS (3 tests, 128k handler calls)

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
Result: PASS (2 tests; latest local run 2026-01-01 with `MAINNET_RPC_URL` set)
- `ownerOf` reverted (non-standard or restricted), logged and allowed.
- `royaltyInfo` reverted (non-ERC2981 or restricted), logged and allowed.

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
Result: PASS (1 test, ~18.6s)
- Mocked E2E specs (`tests/e2e/*`) added but not run in this snapshot.

### Client secret scan
Command:
```sh
npm run check:no-client-secrets
```
Result: PASS (no forbidden strings in the client bundle).

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
- Size cap: `POST /api/pin/metadata` with ~60KB body → `413 Payload too large`.
- Rate limit: 5 requests in quick succession → `429 Rate limit exceeded` after the 4th allowed request (capacity 5, refill 0.5/sec).
- Invalid payloads return `400` before signature checks as expected.

## Static analysis
- Local solhint run:
  - Command: `cd contracts && npx solhint "src/**/*.sol"`
  - Result: 0 errors, 0 warnings (latest local run 2026-01-01).
  - Note: update check failed (`registry.npmjs.org` not reachable), but lint executed successfully.
- Local slither run (venv):
  - Command: `. .venv-slither/bin/activate && cd contracts && slither .`
  - Result: **8 findings**:
    - Weak PRNG in palette index selection (blockhash-derived).
    - Strict equality check in `RoyaltySplitter._send` (amount == 0).
    - Unused return values from `POOL_MANAGER.getSlot0` in `_sqrtPriceLimit` and `_poolInitialized`.
    - Naming convention warnings for immutable constants (LESS_TOKEN, BURN_ADDRESS, POOL_MANAGER).
  - Note: The PRNG is used for art variation; the strict equality and unused-return warnings are intentional for control flow checks.

## Notes
- Fork tests are optional; they skip unless `MAINNET_RPC_URL` is provided.
- Release gate uses `npm run fork-test` with a pinned block via `FORK_BLOCK_NUMBER`.
- CI includes `forge test`, `solhint`, `slither`, coverage (90% minimum), and client secret scan gates.
- CI runs `npm audit` at `--audit-level=high`.
- Local `npm audit --json` (2026-01-01): 0 vulnerabilities.
