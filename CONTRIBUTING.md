# Contributing to cubixles_

Last updated: 2025-12-26

Thanks for your interest in contributing. This doc describes how to propose changes and the standards we expect.

## Ways to contribute
- Report bugs and regressions
- Propose features via issues
- Submit pull requests

## Before you start
- Search existing issues and discussions to avoid duplicates
- For security issues, do not open a public issue. See `SECURITY.md`.

## Development workflow
1. Fork the repo and create a feature branch.
2. Make your changes with clear, focused commits.
3. Run relevant checks:
   - `npm run dev` (UI)
   - `cd contracts && forge test -vvv` (contracts)
   - `npm run coverage:contracts` (coverage gate)
4. Open a pull request with a concise summary and test evidence.

## Code style
- Keep changes minimal and modular.
- Avoid unrelated refactors.
- Prefer explicit naming and small functions.

## Commit sign-off (DCO)
We require Developer Certificate of Origin (DCO) sign-off for all commits.
Add `-s` when committing:
```sh
git commit -s -m "Your message"
```

## Reporting defects
Use `SUPPORT.md` for defect reporting and expected response times.

## License
By contributing, you agree that your contributions are licensed under the terms in `LICENSE`.
