# Release Process

Last updated: 2026-01-02

## Versioning
- Use Semantic Versioning: MAJOR.MINOR.PATCH

## Pre-release checklist
1. Ensure CI passes (forge tests, solhint, slither, coverage gate).
2. Run fork tests with a pinned block:
   - `MAINNET_RPC_URL` set
   - Optional `FORK_BLOCK_NUMBER` (defaults in test)
   - If on macOS, set `NO_PROXY="*"`, `HTTP_PROXY=""`, `HTTPS_PROXY=""`
   - Command: `npm run fork-test`
   - Release rule: do not ship if fork tests are skipped or fail.
3. Update `CHANGELOG.md` with release notes.
4. Verify `docs/30-SECURITY/SECURITY_AUDIT.md` is current.
5. Verify deployment artifacts and contract addresses.

## Release steps
1. Tag the commit: `git tag vX.Y.Z`.
2. Push the tag: `git push origin vX.Y.Z`.
3. Deploy the Next.js app to Vercel.
4. Publish release notes in GitHub Releases.

## Release artifacts
- Contracts ABI and deployment metadata
- Changelog entry
- Security audit snapshot
