# cubixles_ — for_prod (Mainnet primary)

Last updated: 2026-01-03

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
```

5) Fork tests (release gate)
```sh
export MAINNET_RPC_URL="https://your-mainnet-rpc"
export FORK_BLOCK_NUMBER=19000000
export NO_PROXY="*"
export HTTP_PROXY=""
export HTTPS_PROXY=""
npm run fork-test
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
- `CUBIXLES_CHAIN_ID` (optional, defaults to `block.chainid`)
- `CUBIXLES_DEPLOYMENT_PATH` (optional; recommended: `deployments/mainnet.json` when running from `contracts/`)

### Deploy
```sh
cd contracts
forge script script/DeployCubixles.s.sol \
  --rpc-url "$MAINNET_RPC_URL" \
  --private-key "$MAINNET_DEPLOYER_KEY" \
  --broadcast
```

### Export ABI
```sh
node contracts/scripts/export-abi.mjs
```

### Update frontend contract config
- Update `app/_client/src/config/contracts.ts` with the deployed address if needed.
- Confirm `CUBIXLES_CONTRACT.address` matches deployment.

## 2) App setup

### Server env (Vercel or local)
- `PINATA_JWT`
- `ALCHEMY_API_KEY`
- `SERVER_AUTH_SALT`
- `CUBIXLES_CONTRACT_ADDRESS`
- `CUBIXLES_CHAIN_ID=1` (use `11155111` only for Sepolia rehearsal)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (required for mobile browser wallet connections)

### Farcaster manifest (production)
- Publish `public/.well-known/farcaster.json` with `requiredChains: [1]`.
- Ensure `accountAssociation` is signed for the production domain.

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
5) Verify Vercel env secrets are set (no `.env` on mainnet).
6) Set `CUBIXLES_CHAIN_ID=1` and mainnet contract address in config.

## 5) Mainnet deploy (contracts)

1) Deploy on mainnet:
```sh
cd contracts
forge script script/DeployCubixles.s.sol \
  --rpc-url "$MAINNET_RPC_URL" \
  --private-key "$MAINNET_DEPLOYER_KEY" \
  --broadcast
```

2) Export ABI + update frontend config with mainnet address.
3) Record deployment:
   - `contracts/deployments/mainnet.json`
   - CubixlesMinter: `0x2FCC29B8Db193D8c5F1647Cbf1e5eCC03920D62B`
   - RoyaltySplitter: `0x127AB77A7aB14d2Efb4D58249Ecc373f6e6d8dFF`
   - Deploy txs:
     - RoyaltySplitter CREATE: `0xcf880be2f5adf318f328bd5a9702e2536be8372920e929db30e2bc11b2a49777`
     - CubixlesMinter CREATE: `0xf1f1f1eb160bdc9d79ec2d274b0906235c191984a758246788d74a01055e7f50`
   - Ownership transfer (minter → owner): `0x9cef0a4e1a8eb15f8cc29dfbc3d28cc541b5ab3b0ef07abc5941bd41e0f8f42c`

## 6) Mainnet launch validation

1) Mint 1 token with a known wallet.
2) Open `/m/<tokenId>` from a clean browser.
3) Verify:
   - `tokenURI` resolves
   - metadata fields are correct
   - token viewer renders
   - royalties route to splitter
   - $LESS swap output lands in the owner wallet
