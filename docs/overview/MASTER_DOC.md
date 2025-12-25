# cubeless — MASTER_DOC

## Executive Overview

This document is the single entry point for cubeless documentation. It explains what each document does, where to find it, and how to use it in a workflow (spec → build → test → deploy → monitor).

## System Map (Docs by Purpose)

### Product + Specs
- `docs/B-app/20-spec.md` — Product + technical spec for the miniapp and contract behaviors (source of truth for UX + onchain logic).
- `docs/B-app/30-test-plan.md` — Test plan and definition of done for app + contracts.
- `docs/01-decision-log.md` — Dated decisions that explain why certain choices were made.

### Contracts + Deployment
- `docs/contracts/contract_details.md` — Contract architecture, mint flow, pricing, and royalty behavior.
- `docs/contracts/DEPLOYMENT_SEPOLIA.md` — Sepolia deployment steps + environment variables.

### Next.js (App Router)
- `app/api/nonce/route.js` — Nonce endpoint for client auth flows.
- `app/api/pin/metadata/route.js` — Server-side Pinata pinning for metadata.
- `app/api/nfts/route.js` — Alchemy NFT proxy + RPC batch (cached, minimized).
- `app/api/identity/route.js` — Farcaster/ENS identity lookup for the leaderboard.

### Security + Audit
- `docs/security/THREAT_MODEL.md` — Threats, assets, trust boundaries.
- `docs/security/INVARIANTS.md` — Invariants and safety properties.
- `docs/security/KNOWN_LIMITATIONS.md` — Accepted risks + rationale.
- `docs/security/STATIC_ANALYSIS.md` — Slither/solhint usage and policy.
- `docs/security/SECURITY_RUNBOOK.md` — Runbook for tests, incidents, and gates.
- `docs/security/FORK_TESTING.md` — Mainnet fork harness and how to run.
- `docs/security/security_audit.md` — Latest audit execution results + tooling outcomes.

### Project Status + Tasks
- `docs/status/state_of_review.md` — Snapshot of repo alignment and current health.
- `docs/status/remaining_tasks.md` — Owner action items to finish v0.
- `docs/status/TASK_LOG.md` — Chronological task execution log.
- `docs/overview/STRUCTURE.md` — Repository layout and module responsibilities.

### Generated Reports
- `docs/reports/coverage_report.md` — Solidity line coverage report (grouped by contract).

## Workflow (How to Use These Docs)

1) **Scope the build**
   - Read `docs/B-app/20-spec.md`.
   - Confirm decisions in `docs/01-decision-log.md`.
2) **Implement + test**
   - Follow `docs/B-app/30-test-plan.md`.
   - Use `docs/security/SECURITY_RUNBOOK.md` for test + security gates.
3) **Review + deployment**
   - Validate `docs/contracts/contract_details.md` and `docs/contracts/DEPLOYMENT_SEPOLIA.md`.
4) **Security posture**
   - Review `docs/security/*` and update `docs/security/security_audit.md`.
5) **Status + next steps**
   - Check `docs/status/state_of_review.md` and `docs/status/remaining_tasks.md`.

## Glossary

- **cubeLess**: The miniapp + contract system that mints an ERC-721 cube composed of user-selected NFT references.
- **refs / NftRef**: A list of NFT references (contractAddress + tokenId) used to texture the cube.
- **provenance**: Metadata field recording refs and mint context for auditability.
- **animation_url**: Token metadata field that points to the interactive token viewer `/m/<tokenId>`.
- **RoyaltySplitter**: ERC-2981 receiver that forwards royalties and optionally attempts $LESS purchases.
- **$LESS**: The ERC-20 token used for dynamic mint pricing and delta metrics.
- **deltaFromLast**: Current metric used to rank tokens by $LESS supply delta from last transfer snapshot.
- **currentMintPrice**: Mint price computed from $LESS totalSupply and rounded up to `0.0001 ETH`.
- **coverage gate**: Minimum 90% Solidity line coverage enforced by `npm run coverage:contracts`.

## Key Commands

```sh
# Unit + fuzz + invariants
cd contracts
forge test -vvv

# Coverage (writes docs/reports/coverage_report.md)
npm run coverage:contracts

# Static analysis
cd contracts
npx solhint "src/**/*.sol"
slither .
```

## Quick Health Checklist

- `docs/security/security_audit.md` updated with latest tool runs.
- `docs/reports/coverage_report.md` regenerated after test updates.
- `docs/status/state_of_review.md` and `docs/status/remaining_tasks.md` reflect current status.
