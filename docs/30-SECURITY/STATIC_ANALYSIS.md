# cubixles_ — Static Analysis

Last updated: 2026-01-06

## Tools
- Slither (static analyzer)
- Solhint (linting)

## Config
- `contracts/slither.config.json`
- `contracts/.solhint.json`

## Commands
```sh
cd contracts
npx solhint "src/**/*.sol"
```

```sh
python3 -m slither .
```

## Related coverage gate
Coverage is enforced separately via:
```sh
npm run coverage:contracts
```

If `slither` is not on PATH, use a local venv:

```sh
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install slither-analyzer
slither .
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
Latest run: 2026-01-05 (`python3 -m slither .`) — PASS (project findings are suppressed inline).

### Suppressed findings (intentional)
1. **Weak PRNG** — `CubixlesMinter._assignPaletteIndex`
   - Palette selection still mixes user commits with `blockhash`, and the inline `slither-disable` directive keeps this acceptable art-only randomness. The trade-off is documented in `docs/30-SECURITY/KNOWN_LIMITATIONS.md`.
2. **Unused return values** — `RoyaltySplitter._sqrtPriceLimit`, `_poolInitialized`
   - `POOL_MANAGER.getSlot0` exposes multiple slots, but only `sqrtPriceX96` feeds the swap logic. The remaining slots are intentionally ignored and suppressed so Slither focuses on actionable findings.
3. **Missing zero-address validation** — `CubixlesMinter.LESS_TOKEN`
   - Passing `address(0)` enables ETH-only pricing (linear or fixed) without LESS snapshots; a targeted `slither-disable` keeps the check from firing while preserving Base linear mode.

### Dependency findings (noise)
Slither still reports issues inside OpenZeppelin and Uniswap v4 dependencies
(incorrect exponentiation/shift, divide-before-multiply, assembly usage, pragma-version
mixing, dead code, and naming conventions). These are treated as dependency noise and
not modified locally.
