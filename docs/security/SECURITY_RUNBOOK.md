# cubeless — Security Runbook

## Local commands

### Contracts (unit + fuzz + invariants)
```sh
cd contracts
forge test -vvv
forge test --match-path "test/fuzz/*" -vvv
forge test --match-path "test/invariants/*" -vvv
```

### Coverage (Solidity)
```sh
npm run coverage:contracts
```

### Fork tests (optional)
```sh
cd contracts
export MAINNET_RPC_URL="https://your-mainnet-rpc"
forge test --fork-url "$MAINNET_RPC_URL" --match-path "test/fork/*" -vvv
```

### Static analysis
```sh
cd contracts
npx solhint "src/**/*.sol"
slither .
```

## CI gates
- `forge test`
- `solhint` (Solidity lint)
- `slither` (static analysis)
- `forge coverage` (minimum 90% line coverage; report at `docs/reports/coverage_report.md`)

## Incident response
1. Freeze deployments if a critical issue is found.
2. Add a failing regression test that reproduces the issue.
3. Patch contract(s) and rerun: unit + fuzz + invariants + fork.
4. Document the issue and fix in `docs/security/KNOWN_LIMITATIONS.md`.
