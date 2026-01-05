# cubixles_ — Static Analysis

Last updated: 2026-01-03

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
. .venv-slither/bin/activate
slither contracts
```

## Related coverage gate
Coverage is enforced separately via:
```sh
npm run coverage:contracts
```

If `slither` is not on PATH, activate the local venv:

```sh
. .venv-slither/bin/activate
slither .
```

## Triage policy
- Any Slither finding must be fixed or documented in `docs/30-SECURITY/KNOWN_LIMITATIONS.md`.
- If an issue is accepted, include rationale and severity.

## Current findings (triaged)
Latest run: 2026-01-03 (`slither contracts`)

### Project findings
1. **Weak PRNG** — `CubixlesMinter._assignPaletteIndex`
   - Uses blockhash + inputs for palette selection; acceptable for art variance.
   - Tracked in `docs/30-SECURITY/KNOWN_LIMITATIONS.md`.
2. **Unused return values** — `RoyaltySplitter._sqrtPriceLimit`, `_poolInitialized`
   - `POOL_MANAGER.getSlot0` is used only to test initialization; unused slots are intentional.
3. **Local variable shadowing** — `CubixlesMinter.mint` (`tokenURI`)
   - Harmless shadowing of ERC-721 `tokenURI` function name.
4. **Missing zero-address validation** — `CubixlesMinter.LESS_TOKEN`
   - Intentional to support fixed-price mode when `lessToken_ == address(0)`.

### Dependency findings (noise)
Slither also reports issues inside OpenZeppelin and Uniswap v4 dependencies
(incorrect exponentiation/shift, divide-before-multiply, assembly usage, pragma-version
mixing, dead code, and naming conventions). These are treated as dependency noise and
not modified locally.
