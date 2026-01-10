import { JsonRpcProvider, Interface } from "ethers";

const RPC_URL = process.env.MAINNET_RPC_URL;
const SPLITTER =
  process.env.ROYALTY_SPLITTER_ADDRESS || process.env.CUBIXLES_SPLITTER_ADDRESS;
const FROM_BLOCK = process.env.SWAP_FAIL_FROM_BLOCK
  ? Number(process.env.SWAP_FAIL_FROM_BLOCK)
  : undefined;
const TO_BLOCK = process.env.SWAP_FAIL_TO_BLOCK
  ? Number(process.env.SWAP_FAIL_TO_BLOCK)
  : "latest";
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

if (!RPC_URL || !SPLITTER) {
  console.error(
    "Missing MAINNET_RPC_URL or splitter address (ROYALTY_SPLITTER_ADDRESS/CUBIXLES_SPLITTER_ADDRESS)."
  );
  process.exit(1);
}

const iface = new Interface([
  "event SwapFailedFallbackToOwner(uint256 amount, bytes32 reasonHash)",
]);

const provider = new JsonRpcProvider(RPC_URL);

async function emitAlert(payload) {
  if (!ALERT_WEBHOOK_URL) {
    console.warn("[alert]", payload);
    return;
  }
  await fetch(ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function run() {
  const filter = {
    address: SPLITTER,
    topics: [iface.getEvent("SwapFailedFallbackToOwner").topicHash],
    fromBlock: FROM_BLOCK,
    toBlock: TO_BLOCK,
  };

  const logs = await provider.getLogs(filter);
  if (!logs.length) {
    console.log("No swap failures found.");
    return;
  }

  console.log(`Swap failures: ${logs.length}`);
  await emitAlert({
    event: "swap.failure",
    count: logs.length,
    address: SPLITTER,
    fromBlock: FROM_BLOCK ?? null,
    toBlock: TO_BLOCK,
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
