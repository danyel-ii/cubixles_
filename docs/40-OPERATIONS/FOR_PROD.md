# cubixles_ — for_prod (Mainnet primary)

Last updated: 2026-01-08

## 0) Pre-flight (local)

1) Install deps
```sh
npm install
```

2) Run unit + API tests
```sh
npm test
```

3) Run contract tests
```sh
cd contracts
forge test -vvv
```

4) Run coverage + static analysis
```sh
npm run coverage:contracts
cd contracts
npx solhint "src/**/*.sol"
python3 -m slither .
# If slither isn't on PATH:
../.venv-slither/bin/python -m slither .
```

5) Fork tests (release gate)
```sh
export MAINNET_RPC_URL="https://your-mainnet-rpc"
export FORK_BLOCK_NUMBER=19000000
export BASE_RPC_URL="https://your-base-rpc"
export BASE_FORK_BLOCK=30919316
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
npm run fork-test
```

6) Repo secret scan
```sh
npm run check:no-repo-secrets
```

## 1) Contract deploy (mainnet primary, Sepolia rehearsal optional)

### Required env (local)
- Environment variable names use `CUBIXLES_*` for contract/deploy compatibility.
- `CUBIXLES_OWNER`
- `CUBIXLES_LESS_TOKEN` (optional, defaults to mainnet $LESS address)
- `CUBIXLES_BURN_ADDRESS` (optional, defaults to `0x000000000000000000000000000000000000dEaD`)
- `CUBIXLES_POOL_MANAGER` (optional, leave unset for no-swap mode)
- `CUBIXLES_POOL_FEE` (optional, defaults to 0)
- `CUBIXLES_POOL_TICK_SPACING` (required if pool manager is set)
- `CUBIXLES_POOL_HOOKS` (optional, defaults to `0x0000000000000000000000000000000000000000`)
- `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS` (optional, defaults to 0; max 1000)
- `CUBIXLES_RESALE_BPS` (optional, defaults to 500)
- `CUBIXLES_CHAIN_ID` (optional, defaults to `block.chainid` in the deploy script)
- `CUBIXLES_LINEAR_PRICING_ENABLED` (optional; required for Base linear pricing)
- `CUBIXLES_BASE_MINT_PRICE_WEI` (optional; base price for linear pricing)
- `CUBIXLES_BASE_MINT_PRICE_STEP_WEI` (optional; step price for linear pricing)
- `CUBIXLES_FIXED_MINT_PRICE_WEI` (required when LESS + linear pricing are disabled)
- `CUBIXLES_DEPLOYMENT_PATH` (optional, overrides default `contracts/deployments/<chain>.json`)

### Deploy
```sh
npm run deploy:mainnet
```

Optional Sepolia rehearsal:
```sh
cd contracts
forge script script/DeployCubixles.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$SEPOLIA_DEPLOYER_KEY" \
  --broadcast
```

### Export ABI
```sh
node contracts/scripts/export-abi.mjs
```

### Update frontend contract config
- Confirm `contracts/deployments/<chain>.json` was updated by the deploy script.
- `app/_client/src/config/contracts.ts` reads those deployment files; no manual address edits required.

## 2) App setup

### Server env (Vercel or local)
- `PINATA_JWT`
- `ALCHEMY_API_KEY`
- `SERVER_AUTH_SALT`
- `CUBIXLES_CHAIN_ID=1` (server signature verification; use `11155111` only for Sepolia rehearsal)

### Client env (public)
- `NEXT_PUBLIC_DEFAULT_CHAIN_ID=1` (set to `8453` for Base)
- `NEXT_PUBLIC_TOKEN_VIEW_BASE_URL` (prod domain for `external_url` + Farcaster meta)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

### Run dev + smoke
```sh
npm run dev
npm run test:ui
```

## 3) Mainnet mint flow (manual)

1) Open `http://127.0.0.1:3000`
2) Connect wallet on mainnet.
3) Select 1–6 NFTs.
4) Click Mint.
5) Verify:
   - `tokenURI` resolves to `ipfs://<CID>`
   - metadata includes `external_url` and `image`
   - `/m/<tokenId>` loads the correct cube
   - `royaltyInfo` returns splitter + 5% amount

## 4) Mainnet readiness checklist

1) Re-run all tests (unit + fuzz + invariants + fork).
2) Ensure `npm audit --json` shows 0 vulnerabilities.
3) Confirm no client keys in build:
```sh
npm run check:no-client-secrets
```
4) Update docs:
   - `docs/30-SECURITY/SECURITY_AUDIT.md`
   - `docs/60-STATUS/STATE_OF_REVIEW.md`
5) Verify Vercel env secrets are set (no `.env` on mainnet).
6) Set `CUBIXLES_CHAIN_ID=1` for server signature verification and `NEXT_PUBLIC_DEFAULT_CHAIN_ID=1`, then confirm `contracts/deployments/mainnet.json` is current.

## 5) Mainnet deploy (contracts)

1) Deploy on mainnet:
```sh
npm run deploy:mainnet
```

2) Export ABI + update frontend config with mainnet address.
3) Record deployment:
   - `contracts/deployments/mainnet.json`
   - CubixlesMinter: `0x61EdB3bff9c758215Bc8C0B2eAcf2a56c638a6f2`
   - RoyaltySplitter: `0x8c80e16c877F68DFBE461ca64e296e6ec3e69077`
   - Deploy txs:
     - RoyaltySplitter CREATE: `0xf2b2459b9b490cbd058bedebcafe36d4196043947076dd831b889ec26f2e802e`
     - CubixlesMinter CREATE: `0x215a73e4466c4b0c449c7faf4fee6929c9108a67cccc046de0acef8816fe2444`
   - Ownership transfer (minter → owner): `0xb61bdf6419b6f063c55a04620e023d81341019d5385f4e2ba32b2510db66efb8`

## 6) Mainnet launch validation

1) Mint 1 token with a known wallet.
2) Open `/m/<tokenId>` from a clean browser.
3) Verify:
   - `tokenURI` resolves
   - metadata fields are correct
   - token viewer renders
   - royalties route to splitter
   - $LESS swap output lands in the owner wallet

## Appendix: Base ETH-only deploy (no LESS)

- Set `CUBIXLES_LESS_TOKEN=0x0000000000000000000000000000000000000000`.
- Set `CUBIXLES_LINEAR_PRICING_ENABLED=true`.
- Set `CUBIXLES_BASE_MINT_PRICE_WEI` and `CUBIXLES_BASE_MINT_PRICE_STEP_WEI` (defaults: 0.0012 ETH and 0.000012 ETH; immutable once deployed).
- Leave `CUBIXLES_FIXED_MINT_PRICE_WEI=0` (unused on Base).
- Disable swaps by leaving `CUBIXLES_POOL_MANAGER` unset (or `0x0`).
- Deploy:
```sh
npm run deploy:base
```
- Record deployment:
  - `contracts/deployments/base.json`
  - CubixlesMinter: `0x428032392237cb3BA908a6743994380DCFE7Bb74`
  - RoyaltySplitter: `0xBaFeAa2Bd3ecb0dDe992727C289aDFA227CA12E2`
  - Deploy txs:
    - RoyaltySplitter CREATE: `0xbf5a179ce7e4b11ff65699a5d69eac56d8c4b75fd66d38702faab4a28d31c3aa`
    - CubixlesMinter CREATE: `0x35b4b0ab506b3d4677550abc90343300c560e82ddc57c827b6ff1c7b5ac3d78a`
    - Ownership transfer (minter → owner): `0x13910eec38b3f1620da45228df56eb93383a6c03add5c01488c03e94f7b168db`
