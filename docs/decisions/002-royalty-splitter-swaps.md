# ADR 002: Royalty Splitter Swap Flow

## Status
Accepted (2025-12-30)

## Context
Royalties and mint fees should accumulate LESS + PNKSTR while still sending ETH to the owner.

## Decision
All mint fees and ERC-2981 royalties are routed to a RoyaltySplitter that:
- Sends 25% of incoming ETH to the owner.
- Swaps 25% of ETH for LESS and sends it to the owner.
- Swaps 50% of ETH for PNKSTR and sends it to the owner.

## Consequences
- Swap failures fall back to ETH forwarding.
- Pool configuration must be correct at deployment time because the PoolManager is immutable.
