#!/usr/bin/env bash
# ensure a short path to avoid Unix socket length limits
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_env_file() {
  local env_file="$1"
  if [[ -f "${env_file}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi
}

load_env_file "${repo_root}/.env"
load_env_file "${repo_root}/.env.local"

if [[ "${FORK_RPC_URL:-}" == \$* ]]; then
  FORK_RPC_URL=""
fi

if [[ -z "${FORK_RPC_URL:-}" ]]; then
  if [[ -n "${MAINNET_RPC_URL:-}" ]]; then
    FORK_RPC_URL="${MAINNET_RPC_URL}"
  elif [[ -n "${BASE_RPC_URL:-}" ]]; then
    FORK_RPC_URL="${BASE_RPC_URL}"
  fi
fi

if [[ -n "${FORK_RPC_URL:-}" ]]; then
  if [[ -z "${BASE_RPC_URL:-}" && -n "${BASE_FORK_BLOCK:-}" ]]; then
    BASE_RPC_URL="${FORK_RPC_URL}"
  elif [[ -z "${MAINNET_RPC_URL:-}" && -z "${BASE_RPC_URL:-}" ]]; then
    MAINNET_RPC_URL="${FORK_RPC_URL}"
  fi
fi

if [[ -z "${MAINNET_RPC_URL:-}" && -z "${BASE_RPC_URL:-}" ]]; then
  echo "MAINNET_RPC_URL or BASE_RPC_URL is required for fork tests" >&2
  exit 1
fi

export MAINNET_RPC_URL BASE_RPC_URL FORK_RPC_URL

temp_dir=$(mktemp -d "/tmp/cubixles-contracts.XXXXXX")
cleanup() {
  rm -rf "${temp_dir}"
}
trap cleanup EXIT

# copy contracts to shorten all paths (symlinks would still resolve to the long repo path)
cp -a "${repo_root}/contracts" "${temp_dir}/contracts"
cd "${temp_dir}/contracts"
forge test --match-path "test/fork/*" -vvv
