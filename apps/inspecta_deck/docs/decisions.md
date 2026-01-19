# Decisions

## Cache defaults
- TTL defaults are set in `app/_lib/env.ts` (tokens 10m, metadata 24h, provenance 10m, owners 10m, verify 60s) and can be overridden via env vars.
- Cache provider defaults to in-memory unless `CACHE_PROVIDER` is set to `redis` or `kv`.

## Gateway fallback
- IPFS gateways: `https://ipfs.io/ipfs/`, `https://cloudflare-ipfs.com/ipfs/`, `https://gateway.pinata.cloud/ipfs/`.
- Arweave gateways: `https://arweave.net/`, `https://ar-io.net/`.

## Metadata safety
- Metadata fetches are restricted to an allowlist (`METADATA_ALLOWED_HOSTS`, defaults to the gateway hosts above).
- Private/loopback IPs are blocked; fetches enforce timeout + max-bytes caps.

## Provenance scoring
- Confidence weights: metadata reference (0.6), same-transaction mint (0.3), owner overlap (0.1 + overlap ratio up to 0.2).
- Confidence thresholds: high >= 0.75, medium >= 0.4, else low.

## Rate limiting
- Public read endpoints default to 120 req / 60s (token bucket).
- Verify defaults to 5 req / 60s (fixed window); helpdesk defaults to 10 req / 60s (token bucket).
- CSP reporting defaults to 30 req / 60s (token bucket) and drops oversized/invalid payloads.
- Client keys are derived from trusted proxy headers on Vercel (`x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for`).
- Distributed rate limiting uses Redis when `REDIS_URL` is set, otherwise Vercel KV when `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set; falls back to memory.

## Provenance scope
- Owner overlap checks are computed only for candidates found via metadata or same-transaction minting to avoid indexer-like scans.

## Env fallbacks
- Support `ALCHEMY_API_KEY` and `CUBIXLES_CONTRACT_ADDRESS` as fallbacks for local `.env` files.
- If `NETWORK` is missing, map `CUBIXLES_CHAIN_ID`/`BASE_CHAIN_ID` to Alchemy network IDs; otherwise require `NETWORK`.

## Collection pagination
- Use Alchemy `pageKey` for `getNFTsForCollection`; expose `pageKey` to clients.
- `all=true` aggregates pages with a safety cap to avoid long-running requests.

## Base contract support
- Use `CUBIXLES_BASE_CONTRACT_ADDRESS` (Base: `0x4130F69f396f5478CFD1e1792e2970da4299383a`) when `chainId=8453`.

## Base path enforcement
- Default the viewer to `/inspecta_deck` even if `NEXT_PUBLIC_BASE_PATH` is unset or `/`, to keep subpath hosting consistent.

## CSP middleware
- Viewer pages are forced dynamic so Next can attach per-request CSP nonces.
- `FRAME_ANCESTORS` can override the default `frame-ancestors` list.
- `/api/csp-report` accepts CSP telemetry, enforces size/type checks, rate limits per client, strips query/hash from URLs, and returns 204.
- `CSP_REPORT_MAX_BYTES`, `CSP_REPORT_RATE_LIMIT`, `CSP_REPORT_RATE_WINDOW_SECONDS` tune report limits.
- CSP report URIs include the configured base path.

## Base path
- App is configured with `NEXT_PUBLIC_BASE_PATH` (default `/inspecta_deck`) and `assetPrefix` to support subpath hosting.
- Use `withBasePath(...)` for internal links/assets; metadata uses `NEXT_PUBLIC_BASE_URL` when provided.
- When deploying under a subpath, set `NEXT_PUBLIC_BASE_URL` to include the base path (e.g. `https://www.cubixles.xyz/inspecta_deck`).
