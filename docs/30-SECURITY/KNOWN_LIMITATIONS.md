# cubixles_ — Known Limitations

Last updated: 2026-01-10

1. **Strict receiver failure policy**
   - Mint reverts if ETH transfers fail.
   - RoyaltySplitter ETH sends revert on failure, but swap failures fall back to forwarding ETH to the owner.
   - This is intentional but means a misconfigured owner address can block mints or royalty flows.

2. **ERC-721 heterogeneity**
   - `ownerOf` is assumed to be ERC-721 compliant. Non-compliant contracts may revert or return unexpected owners; mint will revert in those cases.

3. **ERC-1155 not supported**
   - v0 selection and provenance logic assume 1-of-1 ERC-721 tokens; ERC-1155 balances and shared metadata are not handled.

4. **PoolManager swap assumptions**
   - Swap logic uses PoolManager `unlock` + `swap` and relies on a configured slippage cap; outcomes depend on pool liquidity and hook behavior.

5. **WETH sweep assumptions**
   - The splitter requires `IWETH.transfer` to return `true` when sweeping WETH without unwrap; non-standard tokens can block WETH sweeps.

6. **Fork tests require secrets**
   - Mainnet fork tests are skipped unless `MAINNET_RPC_URL` is set.
   - Base fork tests are skipped unless `BASE_RPC_URL` is set.

7. **Sale detection is approximated**
   - The “last sale” snapshot uses any ERC-721 transfer (excluding mint), so gifts and sales are treated identically.

8. **Blockhash-based randomness + commit window**
   - Palette randomness uses `blockhash(revealBlock)` salted with the commitment; block producers can influence outcomes within a block.
   - Commits expire after `1 + 256` blocks (delay + window); users must re-commit if they miss the reveal window.

9. **Base pricing immutability**
   - Base mint pricing is configured at deploy time (base + step) and cannot be changed without redeploying.

10. **RPC/provider availability**
   - Fork tests, floor snapshots, and some app views depend on upstream RPCs; outages reduce functionality.

11. **Static analysis posture**
   - Solhint reports Natspec + naming/style warnings; no errors are expected.
   - Slither excludes `naming-convention` via `contracts/slither.config.json`; inline suppressions are limited to intentional sinks/compatibility and dependency noise is ignored.
