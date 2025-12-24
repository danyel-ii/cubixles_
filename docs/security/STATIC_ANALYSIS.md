# cubeless — Static Analysis

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

## Triage policy
- Any Slither finding must be fixed or documented in `docs/security/KNOWN_LIMITATIONS.md`.
- If an issue is accepted, include rationale and severity.
