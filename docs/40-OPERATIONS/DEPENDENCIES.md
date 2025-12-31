# Dependency Management

Last updated: 2025-12-31

## Node/Frontend
- Dependencies are declared in `package.json`.
- Exact versions are locked in `package-lock.json`.
- Update using `npm update` or explicit version bumps in PRs.

## Solidity/Foundry
- Foundry uses `foundry.toml` and `foundry.lock`.
- Solidity libraries are vendored under `contracts/lib`.

## Review process
- Dependency updates must be reviewed and tested.
- Security fixes should be prioritized.
