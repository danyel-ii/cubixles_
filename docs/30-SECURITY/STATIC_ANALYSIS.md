# cubeless — Static Analysis

Last updated: 2025-12-29

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
cd contracts
slither .
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
- **divide-before-multiply (`_roundUp`)**: Safe canonical rounding form `((value + step - 1) / step) * step` is used; no overflow in Solidity 0.8 with checked arithmetic. Accept and monitor.
- **low-level calls (`_transferEth`, PoolManager unlock+swap, `_send`)**: Intentional; failures fall back to owner with `SwapFailedFallbackToOwner`.
- **calls in loop (`ownerOf`)**: Bounded to `refs.length <= 6`, and reverts are handled via `RefOwnershipCheckFailed` / `RefNotOwned`. DoS risk is accepted for strict provenance integrity.
- **strict equality (`amount == 0`, `lessBalance == 0`)**: Safe guard clauses to avoid unnecessary calls; no correctness risk.
- **unused return values**: `unlock` is used for control flow; `getSlot0` uses only `sqrtPriceX96`; `settle` is used for side-effects. Accept.
