# cubixles_ — for_prod (Mainnet primary)

Last updated: 2026-01-10

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
slither . --config-file slither.config.json
# If slither isn't on PATH:
../.venv-slither/bin/python -m slither . --config-file slither.config.json
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
- `CUBIXLES_PNKSTR_TOKEN` (optional; required for swaps)
- `CUBIXLES_PALETTE_IMAGES_CID` (required; base CID for palette images)
- `CUBIXLES_PALETTE_MANIFEST_HASH` (required; keccak256 hash of the manifest JSON)
- `CUBIXLES_POOL_MANAGER` (optional, leave unset for no-swap mode)
- `CUBIXLES_LESS_POOL_FEE` (optional, defaults to 0)
- `CUBIXLES_LESS_POOL_TICK_SPACING` (required if pool manager is set)
- `CUBIXLES_LESS_POOL_HOOKS` (optional, defaults to `0x0000000000000000000000000000000000000000`)
- `CUBIXLES_PNKSTR_POOL_FEE` (optional, defaults to 0)
- `CUBIXLES_PNKSTR_POOL_TICK_SPACING` (required if pool manager is set)
- `CUBIXLES_PNKSTR_POOL_HOOKS` (optional, defaults to `0x0000000000000000000000000000000000000000`)
- `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS` (optional, defaults to 0; max 1000)
- `CUBIXLES_RESALE_BPS` (optional, defaults to 500)
- `CUBIXLES_CHAIN_ID` (optional, defaults to `block.chainid` in the deploy script)
- `CUBIXLES_LINEAR_PRICING_ENABLED` (optional; required for Base linear pricing)
- `CUBIXLES_BASE_MINT_PRICE_WEI` (optional; base price for linear pricing)
- `CUBIXLES_BASE_MINT_PRICE_STEP_WEI` (optional; step price for linear pricing)
- `CUBIXLES_FIXED_MINT_PRICE_WEI` (required when LESS + linear pricing are disabled)
- `CUBIXLES_COMMIT_FEE_WEI` (optional; commit fee credited at mint)
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
   - `tokenURI` resolves to pinned IPFS metadata
   - metadata includes palette traits + image (image points at the palette images CID)
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
7) Ensure the VRF subscription is funded (ETH if `CUBIXLES_VRF_NATIVE_PAYMENT=true`, LINK otherwise) and the minter is added as a consumer.

## 5) Mainnet deploy (contracts)

1) Deploy on mainnet:
```sh
npm run deploy:mainnet
```

2) Export ABI + update frontend config with mainnet address.
3) Record deployment:
   - `contracts/deployments/mainnet.json`
   - CubixlesMinter: `0x5581FeBb14c00bEC1e6C81068CD281EB4e9a9180`
   - RoyaltySplitter: `0xde51FC988DAB8A58b0a491cdFd9f25c95CeB89ba`
   - Deploy txs:
     - RoyaltySplitter CREATE: `0xaa00b5add52c1b71744a4f5ffd4124cf4ff8efbe83eaf237be37410caa75c59f`
     - CubixlesMinter CREATE: `0x6e1d849be44cb473bd134b48650af95f6f738a0afe6dc7e08a9590dc20d1933b`
   - Ownership transfer (minter → owner): `0xde737e7fe5eee8f77f85037785b1a14021edff3397574b57f242c3105a322dca`

## 6) Mainnet launch validation

1) Mint 1 token with a known wallet.
2) Open `/m/<tokenId>` from a clean browser.
3) Verify:
   - `tokenURI` resolves
   - metadata fields are correct (palette traits + image)
   - token viewer renders
   - royalties route to splitter
   - $LESS + $PNKSTR swap outputs land in the owner wallet

## Appendix: Base ETH-only deploy (no LESS)

- Set `CUBIXLES_LESS_TOKEN=0x0000000000000000000000000000000000000000`.
- Set `CUBIXLES_PNKSTR_TOKEN=0x0000000000000000000000000000000000000000`.
- Set `CUBIXLES_LINEAR_PRICING_ENABLED=true`.
- Set `CUBIXLES_BASE_MINT_PRICE_WEI` and `CUBIXLES_BASE_MINT_PRICE_STEP_WEI` (defaults: 0.0012 ETH and 0.000012 ETH; immutable once deployed).
- Leave `CUBIXLES_FIXED_MINT_PRICE_WEI=0` (unused on Base).
- Disable swaps by leaving `CUBIXLES_POOL_MANAGER` unset (or `0x0`).
- Set `CUBIXLES_LESS_POOL_FEE=0`, `CUBIXLES_LESS_POOL_TICK_SPACING=0`, `CUBIXLES_LESS_POOL_HOOKS=0x0`, and `CUBIXLES_SWAP_MAX_SLIPPAGE_BPS=0` to zero out pool config on Base.
- Set `CUBIXLES_PNKSTR_POOL_FEE=0`, `CUBIXLES_PNKSTR_POOL_TICK_SPACING=0`, and `CUBIXLES_PNKSTR_POOL_HOOKS=0x0` to zero out the PNKSTR pool config.
- Configure Base VRF coordinator + subscription id in env.
- Deploy:
```sh
npm run deploy:base
```
- Record deployment:
  - `contracts/deployments/base.json`
  - CubixlesMinter: `0xc17C3930569f799e644909313dfBed968757Df1D`
  - RoyaltySplitter: `0xAba3835D447982e1037035b945c67A9ECbED2829`
  - Deploy txs:
    - RoyaltySplitter CREATE: `0xd285828be6ac81befec8c975c3b509a489cf70c2e85999f9d49a949dc0749398`
    - CubixlesMinter CREATE: `0x088c9936def0f2bc4afd19d6a1f23aa706483c6b24664353d6c04e360044815d`
    - Ownership transfer (minter → owner): `0xb3cae316dbdaecd8fd3d79773ad8a4c2d716c3d26a0cc4704f566eaa90caa153`
