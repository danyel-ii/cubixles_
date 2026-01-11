# Secrets and Credentials Policy

Last updated: 2026-01-10

## Scope
Applies to API keys, RPC URLs, Pinata credentials, and any deployment secrets.

## Storage
- Store secrets only in the hosting provider's secret manager (Vercel, GitHub Actions).
- Use `.env` / `.env.local` only for local development; never commit them.
- Store network-specific deploy settings in `.env.mainnet` / `.env.base` / `.env.sepolia` (git-ignored); use the `.env.*.example` templates for placeholders.
- Never echo secrets in logs or build output.
- Use `.env.example` for non-sensitive placeholders.

## Rotation
- Rotate secrets at least every 90 days or after any suspected compromise.
- Revoke any leaked keys immediately.

## Access control
- Limit secret access to maintainers listed in `docs/40-OPERATIONS/MAINTAINERS.md`.

## Required secrets (app)
- `PINATA_JWT`
- `PINATA_GROUP_ID`
- `ALCHEMY_API_KEY`
- `SERVER_AUTH_SALT` (HMAC nonce signing)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

## Optional secrets (app)
- `NEYNAR_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ALERT_WEBHOOK_URL`

## Deployment and CI secrets
- `MAINNET_RPC_URL`
- `BASE_RPC_URL`
- `SEPOLIA_RPC_URL` (if rehearsing on Sepolia)
- `MAINNET_DEPLOYER_KEY`
- `BASE_DEPLOYER_KEY`
- `SEPOLIA_DEPLOYER_KEY` (if rehearsing on Sepolia)
- `ETHERSCAN_API_KEY` (mainnet + sepolia verification)
- `BASESCAN_API_KEY` (Base verification)
- `CUBIXLES_COMMIT_CANCEL_THRESHOLD` (optional; cancellations before cooldown)
- `CUBIXLES_COMMIT_COOLDOWN_BLOCKS` (optional; cooldown length in blocks)
- Keep the same variable names across environments; use environment-scoped secrets (GitHub Actions environments, Vercel env scopes) or `.env.base` / `.env.mainnet` locally to avoid clobbering values.

## Incident response
- Remove compromised keys from providers.
- Audit recent deployments and access logs.
- Document incident in `docs/30-SECURITY/KNOWN_LIMITATIONS.md` and update `docs/30-SECURITY/SECURITY_AUDIT.md`.
