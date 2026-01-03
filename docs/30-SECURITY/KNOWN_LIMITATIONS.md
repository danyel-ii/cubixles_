# cubixles_ — Known Limitations

Last updated: 2026-01-01

1. **Strict receiver failure policy**
   - Mint and royalty distribution revert if ETH or $LESS transfers fail.
   - This is intentional but means a misconfigured owner address can block mints or royalty flows.

2. **ERC-721 heterogeneity**
   - `ownerOf` is assumed to be ERC-721 compliant. Non-compliant contracts may revert or return unexpected owners; mint will revert in those cases.

3. **ERC-1155 not supported**
   - v0 selection and provenance logic assume 1-of-1 ERC-721 tokens; ERC-1155 balances and shared metadata are not handled.

4. **PoolManager swap assumptions**
   - Swap logic uses PoolManager `unlock` + `swap` and relies on a configured slippage cap; outcomes depend on pool liquidity and hook behavior.

5. **$LESS token transfer assumptions**
   - The splitter assumes `IERC20.transfer` returns a boolean and reverts otherwise.

6. **Fork tests require secrets**
   - Mainnet fork tests are skipped unless `MAINNET_RPC_URL` is set.

7. **Sale detection is approximated**
   - The “last sale” snapshot uses any ERC-721 transfer (excluding mint), so gifts and sales are treated identically.

8. **Static analysis**
   - Slither currently reports no findings; solhint still reports warnings (mostly NatSpec + import-path-check).
