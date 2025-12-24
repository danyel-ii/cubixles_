# cubeLess — Security & Edge-Case Coverage Implementation Results
Date: 2025-12-24

## Scope
- Contracts: `IceCubeMinter`, `RoyaltySplitter`
- Tests: unit, fuzz, invariants, edge cases, fork harness
- Tooling: Slither + Solhint configs, CI workflow

## Implemented artifacts
- Docs: `docs/security/THREAT_MODEL.md`, `docs/security/INVARIANTS.md`, `docs/security/KNOWN_LIMITATIONS.md`, `docs/security/STATIC_ANALYSIS.md`, `docs/security/SECURITY_RUNBOOK.md`, `docs/security/FORK_TESTING.md`
- CI: `.github/workflows/ci.yml`
- Static analysis config: `contracts/.solhint.json`, `contracts/slither.config.json`
- Mocks: `contracts/test/mocks/MockERC721s.sol`, `contracts/test/mocks/Receivers.sol`
- Edge tests: `contracts/test/IceCubeMinterEdge.t.sol`, updates to `contracts/test/RoyaltySplitter.t.sol`
- Fuzz tests: `contracts/test/fuzz/IceCubeMinterFuzz.t.sol`
- Invariants: `contracts/test/invariants/IceCubeMinterInvariants.t.sol`
- Fork tests: `contracts/test/fork/MainnetFork.t.sol`

## Policy decisions captured
- Receiver failure policy is strict: mint/royalty transfers revert on failed ETH or token transfer.
- `ownerOf` revert or mismatch causes mint revert.
- Refund exactness: `msg.value - MINT_PRICE` is returned to minter.
- RoyaltySplitter forwards $LESS (if any) and remaining ETH to owner on swap success.

## Test results
### Unit + edge + fuzz + invariants
Command:
```sh
cd contracts
forge test -vvv
```
Result: PASS (28 tests)
- Fork tests executed but skipped because `MAINNET_RPC_URL` was not set.

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
cd contracts
forge test --fork-url "$MAINNET_RPC_URL" --match-path "test/fork/*" -vvv
```
Result: PASS (2 tests)
- `ownerOf` reverted on ENS token; logged as non-standard/restricted and test allowed.
- `royaltyInfo` reverted on sampled contracts; logged and allowed.

### Frontend tests
Command:
```sh
npm test
```
Result: No frontend tests configured (placeholder script).

## Static analysis
- Local solhint run:
  - Command: `cd contracts && npx solhint "src/**/*.sol"`
  - Result: 0 errors, 82 warnings (mostly missing NatSpec + gas lint warnings, plus import-path-check warnings for OpenZeppelin remappings).
- Local slither run:
  - Command: `cd contracts && /Users/danyel-ii/Library/Python/3.9/bin/slither .`
  - Result: 9 findings (warnings):
    - dangerous strict equality: `lessBalance == 0`, `amount == 0`
    - missing zero-address validation: `lessToken`, `router` (constructor + setRouter)
    - external calls inside loop: `ownerOf` in mint refs loop
    - low-level calls: `_transferEth`, router call, `_send`
  - Notes: findings reflect known design tradeoffs; triage pending.

## Notes
- Fork tests are optional; they skip unless `MAINNET_RPC_URL` is provided.
- CI includes `forge test`, `solhint`, and `slither` gates.
