import { promises as fs } from "node:fs";
import path from "node:path";

import { semanticSearch } from "./vectorIndex";

export type KbEntry = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
};

export type ScoredKbEntry = {
  entry: KbEntry;
  score: number;
};

const KB_INDEX_PATH = path.join(process.cwd(), "kb", "index.jsonl");
let kbEntriesPromise: Promise<KbEntry[]> | null = null;

function parseEntry(raw: any): KbEntry | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const { id, path: filePath, startLine, endLine, text } = raw as KbEntry;
  if (
    typeof id !== "string" ||
    typeof filePath !== "string" ||
    typeof startLine !== "number" ||
    typeof endLine !== "number" ||
    typeof text !== "string"
  ) {
    return null;
  }
  return {
    id,
    path: filePath,
    startLine,
    endLine,
    text,
  };
}

export async function loadKbEntries(): Promise<KbEntry[]> {
  if (kbEntriesPromise) {
    return kbEntriesPromise;
  }

  kbEntriesPromise = (async () => {
    try {
      const content = await fs.readFile(KB_INDEX_PATH, "utf8");
      const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
      return lines
        .map((line) => {
          try {
            return parseEntry(JSON.parse(line));
          } catch {
            return null;
          }
        })
        .filter((entry): entry is KbEntry => Boolean(entry));
    } catch {
      return [];
    }
  })();

  return kbEntriesPromise;
}

function tokenize(query: string): string[] {
  const stopwords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "what",
    "does",
    "when",
    "where",
    "which",
    "how",
    "are",
    "is",
    "in",
    "on",
    "of",
    "to",
    "as",
    "by",
    "or",
  ]);
  return query
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

function keywordScore(text: string, tokens: string[]): number {
  if (!tokens.length) {
    return 0;
  }
  const haystack = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    let idx = haystack.indexOf(token);
    while (idx !== -1) {
      score += 1;
      idx = haystack.indexOf(token, idx + token.length);
    }
  }
  return score;
}

export async function hybridSearch(
  query: string,
  topK = 8
): Promise<ScoredKbEntry[]> {
  const entries = await loadKbEntries();
  if (!entries.length) {
    return [];
  }

  const tokens = tokenize(query);
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const keywordScores = new Map<string, number>();
  let maxKeywordScore = 0;

  if (tokens.length) {
    for (const entry of entries) {
      const score = keywordScore(entry.text, tokens);
      if (score > 0) {
        keywordScores.set(entry.id, score);
        maxKeywordScore = Math.max(maxKeywordScore, score);
      }
    }
  }

  const semanticResults = await semanticSearch(query, Math.max(topK * 3, 12));
  const combinedScores = new Map<string, number>();

  for (const result of semanticResults) {
    const boost = Math.max(result.score, 0);
    if (!Number.isFinite(boost)) {
      continue;
    }
    combinedScores.set(result.id, (combinedScores.get(result.id) ?? 0) + boost * 0.7);
  }

  if (maxKeywordScore > 0) {
    const keywordEntries = Array.from(keywordScores.entries());
    for (const [id, score] of keywordEntries) {
      const normalized = score / maxKeywordScore;
      combinedScores.set(id, (combinedScores.get(id) ?? 0) + normalized * 0.3);
    }
  }

  const scored: ScoredKbEntry[] = [];
  const combinedEntries = Array.from(combinedScores.entries());
  for (const [id, score] of combinedEntries) {
    const entry = entryById.get(id);
    if (!entry) {
      continue;
    }
    const docBoost = entry.path.startsWith("docs/") ? 0.9 : 0;
    scored.push({ entry, score: score + docBoost });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aDoc = a.entry.path.startsWith("docs/");
    const bDoc = b.entry.path.startsWith("docs/");
    if (aDoc !== bDoc) {
      return aDoc ? -1 : 1;
    }
    return a.entry.path.localeCompare(b.entry.path);
  });

  return scored.slice(0, topK);
}
