# cubixles_ — Fork Testing

Last updated: 2025-12-31

## Purpose
Validate `ownerOf` and optional `royaltyInfo` behavior against real mainnet contracts.

## Requirements
- `MAINNET_RPC_URL` environment variable
- Optional `FORK_BLOCK_NUMBER` (defaults to pinned block in test)
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

## Notes
- Tests are skipped if `MAINNET_RPC_URL` is not set.
- Only read-only calls are used.
