#!/usr/bin/env bash
# ensure a short path to avoid Unix socket length limits
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_env_file() {
  local env_file="$1"
  if [[ -f "${env_file}" ]]; then
    local existing_mainnet="${MAINNET_RPC_URL:-}"
    local existing_base="${BASE_RPC_URL:-}"
    local existing_fork="${FORK_RPC_URL:-}"
    local existing_base_block="${BASE_FORK_BLOCK:-}"
    local existing_fork_block="${FORK_BLOCK_NUMBER:-}"
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
    if [[ -n "${existing_mainnet}" ]]; then
      MAINNET_RPC_URL="${existing_mainnet}"
    fi
    if [[ -n "${existing_base}" ]]; then
      BASE_RPC_URL="${existing_base}"
    fi
    if [[ -n "${existing_fork}" ]]; then
      FORK_RPC_URL="${existing_fork}"
    fi
    if [[ -n "${existing_base_block}" ]]; then
      BASE_FORK_BLOCK="${existing_base_block}"
    fi
    if [[ -n "${existing_fork_block}" ]]; then
      FORK_BLOCK_NUMBER="${existing_fork_block}"
    fi
  fi
}

load_env_file "${repo_root}/.env"
load_env_file "${repo_root}/.env.mainnet"
load_env_file "${repo_root}/.env.base"
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
