import { performance } from "node:perf_hooks";

const BASE_URL = process.env.BENCH_BASE_URL || "http://127.0.0.1:3000";
const ITERATIONS = Number(process.env.BENCH_ITERATIONS || 20);
const PATHS = [
  "/api/nfts?mode=rpc&chainId=1",
  "/api/pin/metadata",
];

async function benchGet(path) {
  const timings = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = performance.now();
    const response = await fetch(`${BASE_URL}${path}`);
    await response.text();
    timings.push(performance.now() - start);
  }
  return timings;
}

async function benchPost(path, payload) {
  const timings = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = performance.now();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await response.text();
    timings.push(performance.now() - start);
  }
  return timings;
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  return {
    count: sorted.length,
    avgMs: sum / sorted.length,
    p50Ms: p50,
    p95Ms: p95,
  };
}

async function run() {
  console.log(`Benchmarking ${BASE_URL} with ${ITERATIONS} iterations`);

  const nftsSamples = await benchGet(PATHS[0]);
  console.log("GET /api/nfts", summarize(nftsSamples));

  const pinSamples = await benchPost(PATHS[1], {
    address: "0x0000000000000000000000000000000000000000",
    nonce: "bench.0.0.0",
    signature: "0x",
    payload: { schemaVersion: 1, name: "bench", attributes: [], provenance: { refs: [] } },
  });
  console.log("POST /api/pin/metadata", summarize(pinSamples));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
