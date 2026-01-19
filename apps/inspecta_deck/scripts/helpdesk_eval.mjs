import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const KB_INDEX_PATH = path.join(ROOT, "kb", "index.jsonl");
const EVAL_PATH = path.join(ROOT, "tests", "helpdesk_eval.json");
const RULES_PATH = path.join(ROOT, "agents-helpdesk.md");
const TOP_K = 8;

function tokenize(query) {
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

function extractSymbols(query) {
  const matches = query.match(/\b[A-Za-z][A-Za-z0-9_]*[A-Z][A-Za-z0-9_]*\b/g) ?? [];
  return Array.from(new Set(matches));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function definitionBoost(text, symbols) {
  if (!symbols.length) {
    return 0;
  }
  let boost = 0;
  for (const symbol of symbols) {
    const escaped = escapeRegExp(symbol);
    const functionPattern = new RegExp(
      `\\b(?:export\\s+)?(?:async\\s+)?function\\s+${escaped}\\b`
    );
    const constPattern = new RegExp(
      `\\b(?:export\\s+)?const\\s+${escaped}\\b`
    );
    const classPattern = new RegExp(
      `\\b(?:export\\s+)?class\\s+${escaped}\\b`
    );
    if (functionPattern.test(text)) {
      boost += 12;
      continue;
    }
    if (constPattern.test(text) || classPattern.test(text)) {
      boost += 8;
    }
  }
  return boost;
}

function keywordScore(text, tokens) {
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

function rankEntries(entries, query, topK) {
  const tokens = tokenize(query);
  const symbols = extractSymbols(query);
  const scored = entries
    .map((entry) => {
      const baseScore = keywordScore(entry.text, tokens);
      const symbolScore = definitionBoost(entry.text, symbols);
      if (baseScore <= 0 && symbolScore <= 0) {
        return { entry, score: 0 };
      }
      const docMultiplier = entry.path.startsWith("docs/") ? 4 : 1;
      const docBoost = entry.path.startsWith("docs/") ? 6 : 0;
      return { entry, score: baseScore * docMultiplier + docBoost + symbolScore };
    })
    .filter((item) => item.score > 0);

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

async function loadEvalCases() {
  const content = await fs.readFile(EVAL_PATH, "utf8");
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error("helpdesk_eval.json must be an array");
  }
  return parsed;
}

async function loadKbEntries() {
  const content = await fs.readFile(KB_INDEX_PATH, "utf8");
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
    .filter(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.path === "string" &&
        typeof entry.startLine === "number" &&
        typeof entry.endLine === "number" &&
        typeof entry.text === "string"
    );
}

function buildContext(results) {
  if (!results.length) {
    return "[context/none:1-1]\nNo relevant context found in the knowledge base.";
  }

  return results
    .map(
      ({ entry }) =>
        `[${entry.path}:${entry.startLine}-${entry.endLine}]\n${entry.text}`
    )
    .join("\n\n");
}

function getLlmConfig() {
  const apiKey = process.env.HELPDESK_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const baseUrl = process.env.HELPDESK_LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.HELPDESK_LLM_MODEL ?? "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

async function callLlm(systemPrompt, userPrompt) {
  const { apiKey, baseUrl, model } = getLlmConfig();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`llm_request_failed:${response.status}:${detail}`);
  }

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content ?? null;
}

async function main() {
  const evalCases = await loadEvalCases();
  const entries = await loadKbEntries();
  const { apiKey } = getLlmConfig();
  const llmMode = apiKey ? "live" : "mock";
  const rules = apiKey ? await fs.readFile(RULES_PATH, "utf8") : "";

  console.log(`helpdesk_eval: ${evalCases.length} cases (${llmMode} LLM mode)`);

  const failures = [];

  for (const testCase of evalCases) {
    const question = testCase?.question;
    const expected = Array.isArray(testCase?.expectedCitations)
      ? testCase.expectedCitations
      : [];

    if (typeof question !== "string" || !question.trim()) {
      failures.push({ question: String(question), reason: "invalid_question" });
      continue;
    }

    const results = rankEntries(entries, question, TOP_K);
    const paths = new Set(results.map((result) => result.entry.path));
    const missing = expected.filter((path) => !paths.has(path));

    if (missing.length) {
      failures.push({
        question,
        missing,
        retrieved: Array.from(paths),
      });
    }

    if (apiKey) {
      const context = buildContext(results);
      const systemPrompt = `${rules}\n\nRetrieved context:\n${context}`;
      const userPrompt = `User message:\n${question}`;
      await callLlm(systemPrompt, userPrompt);
    }
  }

  if (failures.length) {
    console.error(`helpdesk_eval: ${failures.length} failures`);
    failures.slice(0, 5).forEach((failure) => {
      console.error(JSON.stringify(failure, null, 2));
    });
    process.exit(1);
  }

  console.log("helpdesk_eval: all checks passed");
}

main().catch((error) => {
  console.error("helpdesk_eval failed:", error);
  process.exit(1);
});
