# cubeless — Static Analysis

Last updated: 2025-12-26

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
slither .
```

## Related coverage gate
Coverage is enforced separately via:
```sh
npm run coverage:contracts
```

If `slither` is not on PATH (common with user-local installs), run:

```sh
/Users/danyel-ii/Library/Python/3.9/bin/slither .
```

## Triage policy
- Any Slither finding must be fixed or documented in `docs/30-SECURITY/KNOWN_LIMITATIONS.md`.
- If an issue is accepted, include rationale and severity.
