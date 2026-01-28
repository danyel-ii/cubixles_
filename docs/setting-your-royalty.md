# Setting Your Builder Royalty Forwarder
Last updated: 2026-01-28

This primer explains how to set resale royalty splits for a builder mint after you
have minted a cubixles_ builder token. The builder mint deploys a per-token
BuilderRoyaltyForwarder that you (the minter) own. You can update the split at
any time.

Builder minting is the primary flow; legacy/bootleg notes only apply to earlier tokens.
For the full builder mint flow, see `docs/builder-mint.md`.

If you minted via the legacy/bootleg flow, this document does not apply. That
flow uses the shared RoyaltySplitter; see `docs/royalty_setter.md`.

## What gets created at mint

- A BuilderRoyaltyForwarder is cloned for your token.
- The token's ERC-2981 royalty receiver is set to that forwarder at 10% (1000 bps).
- The forwarder owner is the wallet that minted the token.
- If no splits are set, 100% of royalties accrue to the owner.

## Step-by-step (Etherscan UI)

1. Find your token id.
   - Use the mint confirmation modal, the mint transaction, or your wallet's
     NFT view.
2. Open the mainnet builder minter contract:
   - `0x35aD1B49C956c0236ADcD2E7051c3C4e78D4FccA`
3. Read the forwarder address:
   - In Etherscan "Read Contract", call
     `royaltyForwarderByTokenId(tokenId)`.
4. Open the forwarder address in Etherscan.
5. Connect the same wallet that minted the builder token.
6. In "Write Contract", call `setSplits(recipients, bps)`:
   - `recipients` is an array of addresses.
   - `bps` is an array of uint16 values in basis points.
   - The sum of `bps` must be <= 10000 (100%).
   - Any remainder (if sum < 10000) goes to the forwarder owner.
7. Verify with `getSplits()` or `pending(address)`.

## Step-by-step (CLI with cast)

1. Export your RPC URL and token id:

```bash
export RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
export TOKEN_ID="4186"
export BUILDER_MINTER="0x35aD1B49C956c0236ADcD2E7051c3C4e78D4FccA"
```

2. Read the forwarder address:

```bash
cast call \
  --rpc-url "$RPC_URL" \
  "$BUILDER_MINTER" \
  "royaltyForwarderByTokenId(uint256)(address)" \
  "$TOKEN_ID"
```

3. Set splits (example below), signing with the minting wallet:

```bash
export FORWARDER="0xYourForwarderAddress"
cast send \
  --rpc-url "$RPC_URL" \
  --private-key "$WALLET_PRIVATE_KEY" \
  "$FORWARDER" \
  "setSplits(address[],uint16[])" \
  "[0xAlice...,0xBob...,0xTreasury...]" \
  "[6000,2500,1500]"
```

4. Confirm the splits:

```bash
cast call \
  --rpc-url "$RPC_URL" \
  "$FORWARDER" \
  "getSplits()(address[],uint16[])"
```

## Example split

Suppose you want:

- 60% to Alice
- 25% to Bob
- 15% to Treasury

Use:

- `recipients = [alice, bob, treasury]`
- `bps = [6000, 2500, 1500]`

If you instead set `[6000, 2500]`, the remaining 15% automatically accrues to
the forwarder owner.

## Withdrawing accrued royalties

Royalties are credited to `pending(address)` for each recipient. Each recipient
withdraws their own balance by calling `withdrawPending()` from their wallet.

## Reset to 100% to the owner

To remove all splits and revert to the default (100% to the owner), call:

```bash
cast send \
  --rpc-url "$RPC_URL" \
  --private-key "$WALLET_PRIVATE_KEY" \
  "$FORWARDER" \
  "setSplits(address[],uint16[])" \
  "[]" \
  "[]"
```
