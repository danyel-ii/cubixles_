# cubixles_ — Known Limitations

Last updated: 2026-01-02

1. **Strict receiver failure policy**
   - Mint and royalty distribution revert if ETH or $LESS transfers fail.
   - This is intentional but means a misconfigured owner address can block mints or royalty flows.

2. **ERC-721 heterogeneity**
   - `ownerOf` is assumed to be ERC-721 compliant. Non-compliant contracts may revert or return unexpected owners; mint will revert in those cases.

3. **PoolManager swap assumptions**
   - Swap logic uses PoolManager `unlock` + `swap` and relies on a configured slippage cap; outcomes depend on pool liquidity and hook behavior.

4. **$LESS token transfer assumptions**
   - The splitter assumes `IERC20.transfer` returns a boolean and reverts otherwise.

5. **Fork tests require secrets**
   - Mainnet fork tests are skipped unless `MAINNET_RPC_URL` is set.

6. **Sale detection is approximated**
   - The “last sale” snapshot uses any ERC-721 transfer (excluding mint), so gifts and sales are treated identically.

7. **Static analysis**
   - Slither findings (2 total) are documented in `docs/30-SECURITY/STATIC_ANALYSIS.md`.
   - Solhint still reports warnings (mostly import-path-check).

8. **Deterministic tokenId salts**
   - TokenId depends on user-provided `salt`; weak salts increase collision/replay risk.
   - UI should generate cryptographically strong salts and warn on reuse.

9. **Owner-controlled parameters**
   - Swap enablement, slippage cap, and royalty receiver are owner-controlled.
   - Recommend multisig and/or timelock for production operations.

10. **API key dependencies**
   - The app relies on Alchemy/Pinata/Neynar keys; outages or key exposure impact availability.
   - Maintain rotation procedures and monitor for failures.
