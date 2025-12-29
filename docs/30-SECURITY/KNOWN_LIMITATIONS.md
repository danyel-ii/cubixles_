# cubeless — Known Limitations

Last updated: 2025-12-29

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

7. **Static analysis false positives**
   - Slither flags `_roundUp`, low-level calls, and unused return values; these are intentional and handled with explicit checks. See `docs/30-SECURITY/STATIC_ANALYSIS.md` for triage details.
