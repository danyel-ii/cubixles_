# cubixles_ — Master Index

Last updated: 2026-01-09

## Executive Overview

This document is the single entry point for cubixles_ documentation. It explains what each document does, where to find it, and how to use it in a workflow (spec → build → test → deploy → monitor).

## System Map (Docs by Purpose)

### Product + Specs
- `docs/10-PRODUCT/SPEC.md` — Product + technical spec for the miniapp and contract behaviors (source of truth for UX + onchain logic).
- `docs/10-PRODUCT/TEST_PLAN.md` — Test plan and definition of done for app + contracts.
- `docs/10-PRODUCT/DECISIONS.md` — Dated decisions that explain why certain choices were made.

### Contracts + Deployment
- `docs/20-CONTRACTS/CONTRACT_DETAILS.md` — Contract architecture, mint flow, pricing, and royalty behavior.
- `docs/20-CONTRACTS/DEPLOYMENT_SEPOLIA.md` — Deployment steps + environment variables (mainnet primary, Sepolia rehearsal).

### Next.js (App Router)
- `app/api/nonce/route.js` — Nonce endpoint for client auth flows.
- `app/api/pin/metadata/route.js` — Server-side Pinata pinning for optional metadata.
- `app/api/nfts/route.js` — Alchemy NFT proxy + RPC batch (cached, minimized).
- `app/api/identity/route.js` — Farcaster/ENS identity lookup for the leaderboard.
- `app/api/csp-report/route.js` — CSP violation report endpoint (telemetry only).

### Security + Audit
- `docs/30-SECURITY/THREAT_MODEL.md` — Threats, assets, trust boundaries.
- `docs/30-SECURITY/INVARIANTS.md` — Invariants and safety properties.
- `docs/30-SECURITY/KNOWN_LIMITATIONS.md` — Accepted risks + rationale.
- `docs/30-SECURITY/STATIC_ANALYSIS.md` — Slither/solhint usage and policy.
- `docs/30-SECURITY/SECURITY_RUNBOOK.md` — Runbook for tests, incidents, and gates.
- `docs/30-SECURITY/FORK_TESTING.md` — Mainnet fork harness and how to run.
- `docs/30-SECURITY/SECURITY_AUDIT.md` — Latest audit execution results + tooling outcomes.
- `docs/30-SECURITY/OSPS_BASELINE_2025-10-10.md` — OSPS Baseline compliance mapping and gaps.

### Governance + Operations
- `docs/40-OPERATIONS/GOVERNANCE.md` — Roles, decision process, and public discussion channels.
- `docs/40-OPERATIONS/MAINTAINERS.md` — Maintainers with access to sensitive resources.
- `docs/40-OPERATIONS/RELEASE.md` — Release process and versioning.
- `docs/40-OPERATIONS/SECRETS_AND_CREDENTIALS.md` — Secrets handling policy.
- `docs/40-OPERATIONS/DEPENDENCIES.md` — Dependency tracking policy.
- `docs/40-OPERATIONS/FOR_PROD.md` — Mainnet deploy + launch checklist (with optional Sepolia rehearsal).

### Project Status + Tasks
- `docs/60-STATUS/STATE_OF_REVIEW.md` — Snapshot of repo alignment and current health.
- `docs/00-OVERVIEW/STRUCTURE.md` — Repository layout and module responsibilities.

### Repository Policies
- `README.md` — Project overview and quickstart.
- `MASTER.md` — Top-level entry point linking into the docs tree.
- `CONTRIBUTING.md` — Contribution guidelines and DCO sign-off.
- `CODE_OF_CONDUCT.md` — Community code of conduct.
- `SECURITY.md` — Vulnerability reporting policy.
- `SUPPORT.md` — Defect reporting and support channels.
- `CHANGELOG.md` — Release notes.

### Generated Reports
- `docs/50-REPORTS/COVERAGE_REPORT.md` — Solidity line coverage report (grouped by contract).

## Workflow (How to Use These Docs)

1) **Scope the build**
   - Read `docs/10-PRODUCT/SPEC.md`.
   - Confirm decisions in `docs/10-PRODUCT/DECISIONS.md`.
2) **Implement + test**
   - Follow `docs/10-PRODUCT/TEST_PLAN.md`.
   - Use `docs/30-SECURITY/SECURITY_RUNBOOK.md` for test + security gates.
3) **Review + deployment**
   - Validate `docs/20-CONTRACTS/CONTRACT_DETAILS.md` and `docs/20-CONTRACTS/DEPLOYMENT_SEPOLIA.md`.
4) **Security posture**
   - Review `docs/30-SECURITY/*` and update `docs/30-SECURITY/SECURITY_AUDIT.md`.
5) **Status + next steps**
   - Check `docs/60-STATUS/STATE_OF_REVIEW.md`.

## Glossary

- **cubixles_**: The miniapp + contract system that mints an ERC-721 cube composed of user-selected NFT references (ERC-1155 is excluded in v0).
- **refs / NftRef**: A list of NFT references (contractAddress + tokenId) used to texture the cube.
- **provenance**: Metadata field recording refs and mint context for auditability.
- **external_url**: Token metadata field that points to the interactive token viewer `/m/<tokenId>`.
- **opengraph-image**: Server-rendered OG image at `/m/<tokenId>/opengraph-image` for link previews.
- **RoyaltySplitter**: ERC-2981 receiver that forwards royalties and optionally attempts $LESS purchases.
- **$LESS**: The ERC-20 token used for dynamic mint pricing and delta metrics.
- **fixedMintPriceWei**: Fixed ETH price used when LESS + linear pricing are disabled.
- **linearPricingEnabled**: Enables immutable base + step pricing (used for Base deployments).
- **baseMintPriceWei**: Base mint price used when linear pricing is enabled.
- **baseMintPriceStepWei**: Price step per mint when linear pricing is enabled.
- **deltaFromLast**: Current metric used to rank tokens by $LESS supply delta from last transfer snapshot.
- **currentMintPrice**: Mint price computed from $LESS totalSupply (mainnet) or base + step (Base).
- **coverage gate**: Minimum 90% Solidity line coverage enforced by `npm run coverage:contracts`.

## Key Commands

```sh
# Ensure submodules are initialized (required for forge imports)
git submodule update --init --recursive

# Unit + fuzz + invariants
cd contracts
forge test -vvv

# Unit + API tests (Vitest)
npm test

# Coverage (writes docs/50-REPORTS/COVERAGE_REPORT.md)
npm run coverage:contracts

# Frontend smoke (Playwright)
npm run test:ui

# Static analysis
cd contracts
npx solhint "src/**/*.sol"
slither . --config-file slither.config.json
# If slither isn't on PATH:
../.venv-slither/bin/python -m slither . --config-file slither.config.json

# Fork tests (release gate)
export MAINNET_RPC_URL=...
export FORK_BLOCK_NUMBER=19000000
export BASE_RPC_URL=...
export BASE_FORK_BLOCK=30919316
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
npm run fork-test

# Client secret scan
npm run check:no-client-secrets

# Repo secret scan
npm run check:no-repo-secrets
```

## Quick Health Checklist

- `docs/30-SECURITY/SECURITY_AUDIT.md` updated with latest tool runs.
- `docs/30-SECURITY/OSPS_BASELINE_2025-10-10.md` reviewed after policy changes.
- `docs/50-REPORTS/COVERAGE_REPORT.md` regenerated after test updates.
- `docs/60-STATUS/STATE_OF_REVIEW.md` reflects current status.
