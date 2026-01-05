# cubixles_ — Fork Testing

Last updated: 2026-01-03

## Purpose
Validate `ownerOf` and optional `royaltyInfo` behavior against real mainnet and Base contracts.

## Requirements
- `MAINNET_RPC_URL` environment variable (mainnet fork)
- `BASE_RPC_URL` environment variable (Base fork)
- `scripts/fork-test.sh` sources `.env` and `.env.local` if present.
- Optional `FORK_BLOCK_NUMBER` or `BASE_FORK_BLOCK` (defaults to pinned block in test)
- On macOS, disable system proxy detection to avoid Foundry crashes:
  - `NO_PROXY="*"`
  - `HTTP_PROXY=""`
  - `HTTPS_PROXY=""`

## Command
```sh
export MAINNET_RPC_URL="https://your-mainnet-rpc"
export FORK_BLOCK_NUMBER=19000000
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
npm run fork-test
```

### Base fork
```sh
export BASE_RPC_URL="https://your-base-rpc"
export BASE_FORK_BLOCK=10000000
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
FORK_RPC_URL="$BASE_RPC_URL" npm run fork-test
```

## Notes
- Tests are skipped if the relevant RPC env var is not set.
- `FORK_RPC_URL` can override the default mainnet RPC for ad-hoc runs.
- Base fork uses Punkology (0x5795060201B64970A02a043A29dA1aedabFa0b35) for `ownerOf`/`royaltyInfo` checks.
- Only read-only calls are used.
- In CI, `MAINNET_RPC_URL` and `BASE_RPC_URL` are expected to be provided as GitHub secrets.
