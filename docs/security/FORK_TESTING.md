# cubeless — Fork Testing

## Purpose
Validate `ownerOf` and optional `royaltyInfo` behavior against real mainnet contracts.

## Requirements
- `MAINNET_RPC_URL` environment variable

## Command
```sh
cd contracts
forge test --fork-url "$MAINNET_RPC_URL" --match-path "test/fork/*" -vvv
```

## Notes
- Tests are skipped if `MAINNET_RPC_URL` is not set.
- Only read-only calls are used.
