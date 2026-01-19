import { promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "@xenova/transformers";

const ROOT = process.cwd();
const INPUT_FILE = path.join(ROOT, "kb", "index.jsonl");
const OUTPUT_FILE = path.join(ROOT, "kb", "vectors.json");
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const BATCH_SIZE = 8;

async function loadIndex() {
  const content = await fs.readFile(INPUT_FILE, "utf8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines
    .map((line) => JSON.parse(line))
    .filter((entry) => entry && typeof entry.id === "string" && typeof entry.text === "string")
    .map((entry) => ({ id: entry.id, text: entry.text }));
}

async function main() {
  const indexEntries = await loadIndex();
  if (!indexEntries.length) {
    console.log("kb_embed: no entries found in kb/index.jsonl");
    return;
  }

  const embedder = await pipeline("feature-extraction", MODEL_ID);
  const vectors = [];

  for (let i = 0; i < indexEntries.length; i += BATCH_SIZE) {
    const batch = indexEntries.slice(i, i + BATCH_SIZE);
    const texts = batch.map((entry) => entry.text);
    const output = await embedder(texts, { pooling: "mean", normalize: true });
    const embeddings = output.tolist();
    const rows = Array.isArray(embeddings[0]) ? embeddings : [embeddings];

    for (let j = 0; j < batch.length; j += 1) {
      vectors.push({ id: batch[j].id, embedding: rows[j] });
    }
  }

  const dims = vectors[0]?.embedding?.length ?? 0;
  const payload = {
    model: MODEL_ID,
    normalized: true,
    dims,
    vectors,
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`kb_embed: ${vectors.length} vectors -> kb/vectors.json`);
}

main().catch((error) => {
  console.error("kb_embed failed:", error);
  process.exit(1);
});
