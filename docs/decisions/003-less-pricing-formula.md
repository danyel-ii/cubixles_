# ADR 003: LESS-Based Mint Pricing

## Status
Accepted (2025-12-30)

## Context
Mint price should respond to LESS scarcity while remaining predictable.

## Decision
Price is computed from LESS totalSupply with:
- Base price: 0.0022 ETH.
- Scale factor between 1.0 and 4.0 based on remaining supply.
- Round up to the nearest 0.0001 ETH.

## Consequences
- Lower supply increases mint cost.
- Rounding reduces price noise and supports consistent UI display.
