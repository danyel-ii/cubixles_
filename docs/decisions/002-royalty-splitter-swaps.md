# ADR 002: Royalty Splitter Swap Flow

## Status
Accepted (2025-12-30)

## Context
Royalties and mint fees should fund LESS accumulation while still sending ETH to the owner.

## Decision
All mint fees and ERC-2981 royalties are routed to a RoyaltySplitter that:
- Sends 50% of incoming ETH to the owner.
- Swaps the remaining ETH for LESS.
- Sends 90% of LESS to the owner and 10% to the burn address.

## Consequences
- Swap failures fall back to ETH forwarding.
- Pool configuration must be correct at deployment time because the PoolManager is immutable.
