# cubeless — Security Runbook

Last updated: 2025-12-26

## Local commands

### Contracts (unit + fuzz + invariants)
```sh
cd contracts
forge test -vvv
forge test --match-path "test/fuzz/*" -vvv
forge test --match-path "test/invariants/*" -vvv
```

### Unit + API tests (Vitest)
```sh
npm test
```

### Coverage (Solidity)
```sh
npm run coverage:contracts
```

### Frontend smoke (Playwright)
```sh
npm run test:ui
```

### Client secret scan
```sh
npm run check:no-client-secrets
```

### Fork tests (release gate)
```sh
export MAINNET_RPC_URL="https://your-mainnet-rpc"
export FORK_BLOCK_NUMBER=19000000
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
npm run fork-test
```

### Static analysis
```sh
cd contracts
npx solhint "src/**/*.sol"
python3 -m slither .
```

## CI gates
- `forge test`
- `solhint` (Solidity lint)
- `slither` (static analysis)
- `forge coverage` (minimum 90% line coverage; report at `docs/50-REPORTS/COVERAGE_REPORT.md`)

## Incident response
1. Freeze deployments if a critical issue is found.
2. Add a failing regression test that reproduces the issue.
3. Patch contract(s) and rerun: unit + fuzz + invariants + fork.
4. Document the issue and fix in `docs/30-SECURITY/KNOWN_LIMITATIONS.md`.

## Proxy IP headers
- Trust `x-forwarded-for` only when `x-vercel-proxied-for` or `x-real-ip` is present.
- Fall back to `x-real-ip` or `"unknown"` if proxy headers are missing.

## HTTP security headers
- Enforce CSP with `frame-ancestors` allowlist to support Farcaster embedding.
- Configure the allowlist via `FRAME_ANCESTORS` (see `.env.example`).
