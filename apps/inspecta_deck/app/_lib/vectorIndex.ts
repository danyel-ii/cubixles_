import { promises as fs } from "node:fs";
import path from "node:path";

type VectorEntry = {
  id: string;
  embedding: Float32Array;
  norm: number;
};

type VectorIndex = {
  model: string;
  normalized: boolean;
  dims: number;
  vectors: VectorEntry[];
};

type ScoredResult = {
  id: string;
  score: number;
};

const VECTOR_PATH = path.join(process.cwd(), "kb", "vectors.json");
const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

let indexPromise: Promise<VectorIndex | null> | null = null;
const embedderPromises = new Map<string, Promise<any>>();

function computeNorm(vector: Float32Array): number {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  return Math.sqrt(sum) || 1;
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

async function loadVectorIndex(): Promise<VectorIndex | null> {
  if (indexPromise) {
    return indexPromise;
  }

  indexPromise = (async () => {
    try {
      const raw = await fs.readFile(VECTOR_PATH, "utf8");
      const parsed = JSON.parse(raw) as {
        model?: string;
        normalized?: boolean;
        dims?: number;
        vectors?: Array<{ id?: string; embedding?: number[] }>;
      };

      const vectors: VectorEntry[] = [];
      const vectorList = Array.isArray(parsed.vectors) ? parsed.vectors : [];
      const normalized = parsed.normalized !== false;
      const model = typeof parsed.model === "string" ? parsed.model : DEFAULT_MODEL;

      for (const entry of vectorList) {
        if (!entry || typeof entry.id !== "string" || !Array.isArray(entry.embedding)) {
          continue;
        }
        const embedding = Float32Array.from(entry.embedding.map((value) => Number(value)));
        if (!embedding.length || embedding.some((value) => Number.isNaN(value))) {
          continue;
        }
        vectors.push({
          id: entry.id,
          embedding,
          norm: normalized ? 1 : computeNorm(embedding),
        });
      }

      if (!vectors.length) {
        return null;
      }

      const dims = Number.isFinite(parsed.dims) ? parsed.dims ?? vectors[0].embedding.length : vectors[0].embedding.length;

      return {
        model,
        normalized,
        dims,
        vectors,
      };
    } catch {
      return null;
    }
  })();

  return indexPromise;
}

async function getEmbedder(model: string) {
  if (embedderPromises.has(model)) {
    return embedderPromises.get(model)!;
  }
  const promise = (async () => {
    const { pipeline } = await import("@xenova/transformers");
    return pipeline("feature-extraction", model);
  })();
  embedderPromises.set(model, promise);
  return promise;
}

async function embedQuery(model: string, text: string): Promise<Float32Array> {
  const embedder = await getEmbedder(model);
  const output = await embedder(text, { pooling: "mean", normalize: true });
  const list = output.tolist();
  const vector = Array.isArray(list[0]) ? list[0] : list;
  return Float32Array.from(vector);
}

export async function semanticSearch(query: string, topK = 8): Promise<ScoredResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const index = await loadVectorIndex();
  if (!index || !index.vectors.length) {
    return [];
  }

  const queryVector = await embedQuery(index.model, trimmed);
  const queryNorm = index.normalized ? 1 : computeNorm(queryVector);

  const scored = index.vectors.map((vector) => ({
    id: vector.id,
    score: dotProduct(queryVector, vector.embedding) / (queryNorm * vector.norm),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
