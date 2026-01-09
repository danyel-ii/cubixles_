# cubixles_ — Static Analysis

Last updated: 2026-01-09

## Tools
- Slither (static analyzer)
- Solhint (linting)

## Config
- `contracts/slither.config.json` (excludes `naming-convention` to avoid renaming immutable ABI getters)
- `contracts/.solhint.json`

## Commands
```sh
cd contracts
npx solhint "src/**/*.sol"
```

```sh
slither . --config-file slither.config.json
```

## Related coverage gate
Coverage is enforced separately via:
```sh
npm run coverage:contracts
```

If `slither` is not on PATH, use a local venv:

```sh
python3 -m venv .venv-slither
. .venv-slither/bin/activate
python3 -m pip install slither-analyzer
python3 -m slither . --config-file slither.config.json
```

## Triage policy
- Any Slither finding must be fixed or documented in `docs/30-SECURITY/KNOWN_LIMITATIONS.md`.
- If an issue is accepted, include rationale and severity.

## Solhint suppressions
- `immutable-vars-naming` is disabled on immutable addresses that mirror on-chain constants
  (`LESS_TOKEN`, `BURN_ADDRESS`, `POOL_MANAGER`) to avoid renaming ABI getters.
- `gas-indexed-events` is suppressed where indexing would change event data layout for
  downstream consumers (`FixedMintPriceUpdated`, `WethSwept`).

## Slither status
Latest run: 2026-01-09 (`slither . --config-file slither.config.json`) — 7 findings (reviewed below); `naming-convention` excluded in config.

### Reviewed findings (documented)
1. **Dangerous strict equalities**
   - `commit.blockNumber == 0` sentinel and palette swap sentinel in `CubixlesMinter`.
   - Acceptable sentinels; documented in `docs/30-SECURITY/KNOWN_LIMITATIONS.md`.
2. **Contracts that lock ether**
   - `MintBlocker` intentionally receives ETH and does not expose withdrawals (legacy disable-mint sink).
3. **Reentrancy warnings on `commitMint`**
   - VRF coordinator call occurs before state writes; the coordinator is trusted, but Slither flags it.
   - Consider `nonReentrant` or reordering if we want to silence the warning.
4. **Cyclomatic complexity**
   - Constructor in `CubixlesMinter` exceeds Slither complexity heuristic; no behavior impact.

### Suppressed findings (intentional)
1. **Unused return values** — `RoyaltySplitter._sqrtPriceLimit`, `_poolInitialized`
   - `POOL_MANAGER.getSlot0` exposes multiple slots, but only `sqrtPriceX96` feeds the swap logic. The remaining slots are intentionally ignored and suppressed so Slither focuses on actionable findings.
2. **Missing zero-address validation** — `CubixlesMinter.LESS_TOKEN`
   - Passing `address(0)` enables ETH-only pricing (linear or fixed) without LESS snapshots; a targeted `slither-disable` keeps the check from firing while preserving Base linear mode.

### Dependency findings (noise)
Slither still reports issues inside OpenZeppelin and Uniswap v4 dependencies
(incorrect exponentiation/shift, divide-before-multiply, assembly usage, pragma-version
mixing, dead code). These are treated as dependency noise and
not modified locally.
