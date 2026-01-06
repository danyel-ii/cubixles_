# cubixles_ — Threat Model

Last updated: 2026-01-06

## Scope
- Contracts: `CubixlesMinter`, `RoyaltySplitter`
- Assets: mint payments, ERC-721 tokens, royalties, $LESS proceeds, tokenURI integrity

## Actors
- **Owner**: receives mint payments + royalties, can update royalty receiver and swap enablement.
- **Minter**: mints NFTs by proving ownership of referenced NFTs.
- **Router**: optional external swap target for royalties.
- **Referenced NFT contracts**: external ERC-721 contracts used for gating.

## Trust boundaries
- External calls to `IERC721.ownerOf` (untrusted contract behavior).
- External calls to PoolManager unlock/swap (external execution paths).
- ETH transfers to owner/minter (receiver-controlled code).
- ERC-20 transfer of $LESS (token contract behavior).
- RPC/provider availability for fork tests and UI floor queries.

## Attack surfaces
- `CubixlesMinter.mint` (external, payable, external calls + transfers).
- `RoyaltySplitter.receive/fallback` (external, payable, PoolManager swap + token transfers).

## Threats
1. **Reentrancy on payable transfers**
   - Owner/minter receive hooks attempt reentrancy or state corruption.
2. **Malicious ERC-721 contracts**
   - `ownerOf` reverts or returns incorrect owner.
3. **Router misbehavior**
   - Swap call reverts or consumes gas.
4. **Receiver failure**
   - Owner or minter refund reverts to block mint or royalty processing.
5. **ERC-20 transfer failure**
   - $LESS transfer fails (token-specific behavior).
6. **Value conservation**
   - Overpayment not refunded; mint price not paid to owner.
7. **Base pricing misconfiguration**
   - Base linear pricing is immutable once deployed; mis-set base or step requires a redeploy.
8. **RPC/provider outages**
   - Fork tests and UI data may fail under provider degradation.

## Security posture decisions
- **Receiver failure policy (mint)**: strict. If owner or refund transfer fails, mint reverts.
- **External call containment**: `nonReentrant` on mint and splitter receive.
- **State-before-callback**: mint state is finalized before `_safeMint` callback.
- **Rounding rule**: no splits in mint; refund exact `msg.value - MINT_PRICE`.
- **ERC-721 behavior**: if `ownerOf` reverts or returns a different owner, mint reverts.
