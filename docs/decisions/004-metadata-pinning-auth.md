# ADR 004: Signed Metadata Pinning

## Status
Accepted (2025-12-30)

## Context
Pinning metadata on behalf of users must be protected from abuse and replay.

## Decision
Require a short-lived nonce and wallet signature to authorize pinning requests.

## Consequences
- Pinning routes are protected from unauthenticated abuse.
- Clients must request a nonce and sign before pinning.
