# cubeless — Known Limitations

1. **Strict receiver failure policy**
   - Mint and royalty distribution revert if ETH or $LESS transfers fail.
   - This is intentional but means a misconfigured owner address can block mints or royalty flows.

2. **ERC-721 heterogeneity**
   - `ownerOf` is assumed to be ERC-721 compliant. Non-compliant contracts may revert or return unexpected owners; mint will revert in those cases.

3. **Router behavior is opaque**
   - Swap logic is a single router call with caller-supplied calldata; router behavior is not validated on-chain.

4. **$LESS token transfer assumptions**
   - The splitter assumes `IERC20.transfer` returns a boolean and reverts otherwise.

5. **Fork tests require secrets**
   - Mainnet fork tests are skipped unless `MAINNET_RPC_URL` is set.
