# OSPS Baseline (2025-10-10) Compliance Review

Last updated: 2025-12-26

This document maps repo practices to the OpenSSF OSPS Baseline (2025-10-10).
Status labels:
- **Met**: Implemented in repo.
- **Config**: Requires GitHub/Vercel/org settings.
- **Planned**: Documented but not fully enforced.
- **NA**: Not applicable until first public release.

## Access Control
- OSPS-AC-01.01 (MFA for sensitive actions): **Config** — enforce via GitHub org settings.
- OSPS-AC-02.01 (least privilege for new collaborators): **Config** — set repo role defaults.
- OSPS-AC-03.01 (block direct commits to primary branch): **Config** — branch protection required.
- OSPS-AC-03.02 (prevent primary branch deletion): **Config** — branch protection required.
- OSPS-AC-04.01 (least permissions for CI tasks): **Met** — `permissions` set in `.github/workflows/ci.yml`.
- OSPS-AC-04.02 (minimum job permissions): **Met** — read-only permissions in CI.

## Build and Release
- OSPS-BR-01.01/01.02 (sanitize CI inputs/branch names): **Met** — no untrusted inputs used in CI steps.
- OSPS-BR-02.01 (unique release version): **Planned** — see `docs/40-OPERATIONS/RELEASE.md`.
- OSPS-BR-02.02 (assets tied to version): **Planned** — release process defined, no public releases yet.
- OSPS-BR-03.01/03.02 (project URIs use HTTPS): **Met** — docs and endpoints are HTTPS.
- OSPS-BR-04.01 (release notes/log): **Planned** — `CHANGELOG.md` in place.
- OSPS-BR-05.01 (standard dependency tooling): **Met** — npm + Foundry locks.
- OSPS-BR-06.01 (signed releases or signed manifest): **Planned** — not yet implemented.
- OSPS-BR-07.01 (prevent secrets in VCS): **Met** — `.gitignore` + `.env.example` + policy.
- OSPS-BR-07.02 (secrets policy): **Met** — `docs/40-OPERATIONS/SECRETS_AND_CREDENTIALS.md`.

## Documentation
- OSPS-DO-01.01 (user guide for basic functionality): **Met** — `docs/00-OVERVIEW/MASTER.md`.
- OSPS-DO-02.01 (defect reporting guide): **Met** — `SUPPORT.md`.
- OSPS-DO-03.01/03.02 (verify release integrity + authenticity): **Planned** — `docs/40-OPERATIONS/RELEASE.md`.
- OSPS-DO-06.01 (dependency selection + tracking): **Met** — `docs/40-OPERATIONS/DEPENDENCIES.md`.

## Governance
- OSPS-GV-01.01 (list members w/ sensitive access): **Met** — `docs/40-OPERATIONS/MAINTAINERS.md`.
- OSPS-GV-01.02 (roles/responsibilities): **Met** — `docs/40-OPERATIONS/GOVERNANCE.md`.
- OSPS-GV-02.01 (public discussion mechanism): **Met** — GitHub Issues/PRs.
- OSPS-GV-03.01 (contribution process): **Met** — `CONTRIBUTING.md`.
- OSPS-GV-03.02 (contributor guide w/ requirements): **Met** — `CONTRIBUTING.md`.

## Legal
- OSPS-LE-02.01/02.02/03.01/03.02 (OSI license in repo/assets): **Met** — `LICENSE` (MIT).
- OSPS-LE-01.01 (contributor legal authorization): **Planned** — DCO policy in `CONTRIBUTING.md` (enforcement in CI not yet added).

## Quality
- OSPS-QA-01.01/01.02 (public repo and change history): **Met** — GitHub repo.
- OSPS-QA-02.01 (dependency list): **Met** — `package.json` + `foundry.lock`.
- OSPS-QA-03.01 (status checks on primary branch): **Config** — branch protection required.
- OSPS-QA-04.01 (list subprojects): **Met** — `docs/00-OVERVIEW/STRUCTURE.md`.
- OSPS-QA-05.01/05.02 (no generated binaries): **Met** — build artifacts are ignored.
- OSPS-QA-06.01 (automated tests on commits): **Config** — CI exists, enforce required checks via branch protection.

## Security Assessment
- OSPS-SA-01.01/02.01 (design + interface docs): **Met** — `docs/20-CONTRACTS/CONTRACT_DETAILS.md`.
- OSPS-SA-03.01 (security assessment): **Met** — `docs/30-SECURITY/SECURITY_AUDIT.md`.

## Vulnerability Management
- OSPS-VM-01.01 (CVD policy): **Met** — `SECURITY.md`.
- OSPS-VM-02.01 (security contacts): **Met** — `SECURITY.md`.
- OSPS-VM-03.01 (private reporting): **Met** — `SECURITY.md`.
- OSPS-VM-04.01 (publish vulnerability data): **Planned** — GitHub Security Advisories once any CVEs exist.

## Open items (require configuration)
- Enable branch protection on `main` with required status checks.
- Enforce MFA for maintainers and collaborators.
- Add release signing (e.g., sigstore) and SBOM generation for published releases.
- Add CI DCO or signed-commit enforcement if desired.
