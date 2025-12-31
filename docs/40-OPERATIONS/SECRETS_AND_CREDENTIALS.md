# Secrets and Credentials Policy

Last updated: 2025-12-31

## Scope
Applies to API keys, RPC URLs, Pinata credentials, and any deployment secrets.

## Storage
- Store secrets only in the hosting provider's secret manager (Vercel, GitHub Actions).
- Never commit secrets to the repository.
- Use `.env.example` for non-sensitive placeholders.

## Rotation
- Rotate secrets at least every 90 days or after any suspected compromise.
- Revoke any leaked keys immediately.

## Access control
- Limit secret access to maintainers listed in `docs/40-OPERATIONS/MAINTAINERS.md`.

## Required secrets
- `PINATA_JWT`
- `ALCHEMY_API_KEY`
- `SERVER_AUTH_SALT` (HMAC nonce signing)

## Optional secrets
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Incident response
- Remove compromised keys from providers.
- Audit recent deployments and access logs.
- Document incident in `docs/30-SECURITY/KNOWN_LIMITATIONS.md`.
