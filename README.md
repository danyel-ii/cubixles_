# cubeLess

Last updated: 2025-12-26

cubeLess is a miniapp that lets users mint interactive cubes whose provenance is tied to NFTs they already own.
The frontend runs on Next.js, and the contracts are built and tested with Foundry.

## Repository layout
- `app/` — Next.js app router, API routes, and UI.
- `app/_client/` — client-side modules (p5, UI panels, mint flow, data).
- `contracts/` — Solidity contracts + tests + scripts.
- `docs/` — architecture, security, operations, and status docs.

## Quickstart
```sh
npm install
npm run dev
```

## Contracts
```sh
cd contracts
forge test -vvv
```

## Coverage + security checks
```sh
npm run coverage:contracts
npm run check:no-client-secrets
cd contracts
npx solhint "src/**/*.sol"
python3 -m slither .
```

## Fork tests (release gate)
```sh
export MAINNET_RPC_URL=...
export FORK_BLOCK_NUMBER=19000000
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
npm run fork-test
```

## Configuration
Copy `.env.example` to `.env` and set values. The Next.js server reads server-only keys and exposes only what is required to the client.

## Documentation
Start with:
- `MASTER.md`
- `docs/00-OVERVIEW/MASTER.md`
- `docs/20-CONTRACTS/CONTRACT_DETAILS.md`
- `docs/30-SECURITY/SECURITY_AUDIT.md`

## Support
See `SUPPORT.md` for defect reporting and help channels.

## Security
See `SECURITY.md` for vulnerability reporting guidance.

## License
See `LICENSE`.
