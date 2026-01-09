# Secrets and Credentials Policy

Last updated: 2026-01-09

## Scope
Applies to API keys, RPC URLs, Pinata credentials, and any deployment secrets.

## Storage
- Store secrets only in the hosting provider's secret manager (Vercel, GitHub Actions).
- Use `.env` / `.env.local` only for local development; never commit them.
- Store network-specific deploy settings in `.env.mainnet` / `.env.base` (git-ignored); use the `.env.*.example` templates for placeholders.
- Never echo secrets in logs or build output.
- Use `.env.example` for non-sensitive placeholders.

## Rotation
- Rotate secrets at least every 90 days or after any suspected compromise.
- Revoke any leaked keys immediately.

## Access control
- Limit secret access to maintainers listed in `docs/40-OPERATIONS/MAINTAINERS.md`.

## Required secrets (app)
- `PINATA_JWT`
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
- `CUBIXLES_VRF_COORDINATOR`
- `CUBIXLES_VRF_KEY_HASH`
- `CUBIXLES_VRF_SUBSCRIPTION_ID`
- `CUBIXLES_VRF_REQUEST_CONFIRMATIONS`
- `CUBIXLES_VRF_CALLBACK_GAS_LIMIT`
- Base VRF mirrors are stored with the `_BASE` suffix in GitHub/Vercel (e.g., `CUBIXLES_VRF_COORDINATOR_BASE`) to avoid clobbering mainnet values.

## Incident response
- Remove compromised keys from providers.
- Audit recent deployments and access logs.
- Document incident in `docs/30-SECURITY/KNOWN_LIMITATIONS.md` and update `docs/30-SECURITY/SECURITY_AUDIT.md`.
