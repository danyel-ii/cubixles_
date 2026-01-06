import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ABI = [
  "function setFixedMintPrice(uint256 price)",
  "function fixedMintPriceWei() view returns (uint256)",
  "function lessEnabled() view returns (bool)",
  "function linearPricingEnabled() view returns (bool)",
];

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function getOptionalEnv(key, fallback = null) {
  const value = process.env[key];
  return value && value.trim().length ? value : fallback;
}

async function loadDeploymentAddress() {
  const direct = getOptionalEnv("CUBIXLES_BASE_MINTER_ADDRESS");
  if (direct) {
    return direct;
  }
  const deploymentPath =
    getOptionalEnv("CUBIXLES_DEPLOYMENT_PATH") ||
    path.join(__dirname, "..", "contracts", "deployments", "base.json");
  const raw = await fs.readFile(deploymentPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed?.address) {
    throw new Error(`Missing address in deployment file: ${deploymentPath}`);
  }
  return parsed.address;
}

function pickFloorPrice(payload) {
  const sources = [
    payload?.openSea,
    payload?.looksRare,
    payload?.x2y2,
    payload?.blur,
  ].filter(Boolean);
  for (const source of sources) {
    const price = source.floorPrice;
    if (typeof price === "number" && price > 0) {
      const currency = (source.priceCurrency || "ETH").toUpperCase();
      if (currency !== "ETH" && currency !== "WETH") {
        throw new Error(`Unsupported floor currency: ${currency}`);
      }
      return price;
    }
  }
  return null;
}

async function fetchFloorPrice() {
  const apiKey = requireEnv("ALCHEMY_API_KEY");
  const punkology =
    getOptionalEnv("PUNKOLOGY_CONTRACT_ADDRESS") ||
    "0x5795060201B64970A02a043A29dA1aedabFa0b35";
  const url = new URL(
    `https://base-mainnet.g.alchemy.com/nft/v3/${apiKey}/getFloorPrice`
  );
  url.searchParams.set("contractAddress", punkology);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Alchemy floor request failed (${response.status}).`);
  }
  const json = await response.json();
  const floor = pickFloorPrice(json);
  if (!floor) {
    throw new Error("No floor price returned from Alchemy.");
  }
  return { floor, raw: json };
}

async function main() {
  const multiplier = Number(getOptionalEnv("PUNKOLOGY_PRICE_MULTIPLIER", "2"));
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error("PUNKOLOGY_PRICE_MULTIPLIER must be a positive number.");
  }

  const baseRpc =
    getOptionalEnv("BASE_RPC_URL") ||
    `https://base-mainnet.g.alchemy.com/v2/${requireEnv("ALCHEMY_API_KEY")}`;

  const minterAddress = await loadDeploymentAddress();
  const provider = new ethers.JsonRpcProvider(baseRpc);
  const contract = new ethers.Contract(minterAddress, ABI, provider);

  const linearPricingEnabled = await contract.linearPricingEnabled();
  if (linearPricingEnabled) {
    throw new Error(
      "Linear pricing is enabled; Base mint pricing is immutable and cannot be updated."
    );
  }

  const lessEnabled = await contract.lessEnabled();
  if (lessEnabled) {
    throw new Error("lessEnabled is true; fixed price updates are disabled.");
  }

  const dryRun = process.argv.includes("--dry-run");
  const deployerKey =
    getOptionalEnv("BASE_DEPLOYER_KEY") || getOptionalEnv("DEPLOYER_KEY");
  if (!deployerKey) {
    throw new Error("Missing BASE_DEPLOYER_KEY (or DEPLOYER_KEY).");
  }

  const { floor } = await fetchFloorPrice();
  const targetPrice = floor * multiplier;
  const priceWei = ethers.parseEther(String(targetPrice));

  const current = await contract.fixedMintPriceWei();
  console.log(`Punkology floor: ${floor} ETH`);
  console.log(`Multiplier: ${multiplier}x`);
  console.log(`Target mint price: ${targetPrice} ETH`);
  console.log(`Current fixed price: ${ethers.formatEther(current)} ETH`);
  if (dryRun) {
    console.log("Dry run enabled; no transaction sent.");
    return;
  }

  const signer = new ethers.Wallet(deployerKey, provider);
  const writer = contract.connect(signer);
  const tx = await writer.setFixedMintPrice(priceWei);
  console.log(`Submitted tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
