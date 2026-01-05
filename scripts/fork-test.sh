#!/usr/bin/env bash
set -euo pipefail

FORK_RPC_URL="${FORK_RPC_URL:-${MAINNET_RPC_URL:-}}"

if [[ -z "${FORK_RPC_URL}" ]]; then
  echo "FORK_RPC_URL (or MAINNET_RPC_URL) is required for fork tests" >&2
  exit 1
fi

cd contracts
forge test --match-path "test/fork/*" --fork-url "$FORK_RPC_URL" -vvv
