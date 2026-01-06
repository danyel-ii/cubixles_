# cubixles_ — Fork Testing

Last updated: 2026-01-06

## Purpose
Validate fork connectivity for Base and read-only `ownerOf`/`royaltyInfo` behavior on mainnet.

## Requirements
- `MAINNET_RPC_URL` environment variable (mainnet fork)
- `BASE_RPC_URL` environment variable (Base fork)
- `scripts/fork-test.sh` sources `.env` and `.env.local` if present.
- Optional fork blocks:
  - `FORK_BLOCK_NUMBER` for mainnet
  - `BASE_FORK_BLOCK` for Base
  - Both default to the pinned blocks in the tests
- Optional Base chain id:
  - `BASE_FORK_CHAIN_ID` (default 8453)
- Optional Base test address:
  - `BASE_FORK_TEST_ADDRESS` (if set, asserts code exists at the fork block)
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
export BASE_FORK_BLOCK=30919316
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
npm run fork-test
```

## Notes
- Tests are skipped if the relevant RPC env var is not set.
- `FORK_RPC_URL` can override the default mainnet RPC or fill in a missing chain for ad-hoc runs.
- Base fork asserts chain id + fork block; if `BASE_FORK_TEST_ADDRESS` is set, it also checks that address has bytecode.
- Only read-only calls are used.
- In CI, `MAINNET_RPC_URL` and `BASE_RPC_URL` are expected to be provided as GitHub secrets.
