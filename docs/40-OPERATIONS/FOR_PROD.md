# cubixles_ — for_prod (Mainnet primary)

Last updated: 2025-12-31

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
- `ICECUBE_OWNER`
- `ICECUBE_LESS_TOKEN` (optional, defaults to mainnet $LESS address)
- `ICECUBE_BURN_ADDRESS` (optional, defaults to `0x000000000000000000000000000000000000dEaD`)
- `ICECUBE_POOL_MANAGER` (optional, leave unset for no-swap mode)
- `ICECUBE_POOL_FEE` (optional, defaults to 0)
- `ICECUBE_POOL_TICK_SPACING` (required if pool manager is set)
- `ICECUBE_POOL_HOOKS` (optional, defaults to `0x0000000000000000000000000000000000000000`)
- `ICECUBE_SWAP_MAX_SLIPPAGE_BPS` (optional, defaults to 0; max 1000)
- `ICECUBE_RESALE_BPS` (optional, defaults to 500)

### Deploy
```sh
cd contracts
forge script script/DeployIceCube.s.sol \
  --rpc-url "$MAINNET_RPC_URL" \
  --private-key "$MAINNET_DEPLOYER_KEY" \
  --broadcast
```

Optional Sepolia rehearsal:
```sh
cd contracts
forge script script/DeployIceCube.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --private-key "$SEPOLIA_DEPLOYER_KEY" \
  --broadcast
```

### Export ABI
```sh
node contracts/scripts/export-abi.mjs
```

### Update frontend contract config
- Update `app/_client/src/config/contracts.ts` with the deployed address if needed.
- Confirm `ICECUBE_CONTRACT.address` matches deployment.

## 2) App setup

### Server env (Vercel or local)
- `PINATA_JWT`
- `ALCHEMY_API_KEY`
- `SERVER_AUTH_SALT`
- `ICECUBE_CONTRACT_ADDRESS`
- `ICECUBE_CHAIN_ID=1` (use `11155111` only for Sepolia rehearsal)

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
   - metadata includes `animation_url` and `image`
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
6) Set `ICECUBE_CHAIN_ID=1` and mainnet contract address in config.

## 5) Mainnet deploy (contracts)

1) Deploy on mainnet:
```sh
cd contracts
forge script script/DeployIceCube.s.sol \
  --rpc-url "$MAINNET_RPC_URL" \
  --private-key "$MAINNET_DEPLOYER_KEY" \
  --broadcast
```

2) Export ABI + update frontend config with mainnet address.
3) Record deployment:
   - `contracts/deployments/mainnet.json`
   - IceCubeMinter: `0x4130F69f396f5478CFD1e1792e2970da4299383a`
   - RoyaltySplitter: `0xf7B96E93D7E4b5aBf80E703Bb358E4Cb8aa53043`
   - Deploy txs:
     - `0xeda91b2834d1fab6b5ee931b1ca1c9a9cb26ab571d50477c62e13cccd2fa3c57`
     - `0x0d89d39da96ed1ff7b681d7a8f4c23dc388403b220fb1f6298834e14e9a03c6d`
   - Ownership transfer (minter → splitter): `0xf9c2f5a30edbadb28ae76564fd9c0ba2ee7eeafe7b775bfb474c910b44d59bba`

## 6) Mainnet launch validation

1) Mint 1 token with a known wallet.
2) Open `/m/<tokenId>` from a clean browser.
3) Verify:
   - `tokenURI` resolves
   - metadata fields are correct
   - token viewer renders
   - royalties route to splitter
   - $LESS swap output lands in the owner wallet
