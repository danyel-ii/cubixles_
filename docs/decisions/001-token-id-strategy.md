# ADR 001: Deterministic Token IDs

## Status
Accepted (2025-12-30)

## Context
The product requires provenance-bound NFTs and a stable token viewer URL before minting.

## Decision
Token IDs are derived from a hash of the minter address, a user-provided salt, and a canonicalized refs hash.

## Consequences
- Token IDs are deterministic and can be previewed before minting.
- IDs are not sequential, which avoids predictable sniping but makes ordering non-linear.
