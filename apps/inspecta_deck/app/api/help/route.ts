import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { hybridSearch } from "../../_lib/kb";
import { getTrustedClientIp } from "../../_lib/request";
import { checkTokenBucket, getHelpdeskRateLimitConfig } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";

type HelpRequest = {
  message?: string;
  diagnostics?: Record<string, unknown> | null;
};

type Citation = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
};

type ContextChunk = Citation & {
  text: string;
};

const DEFAULT_TOP_K = 8;
const DEFAULT_MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_MAX_TOKENS = 700;
const MAX_BODY_BYTES = parsePositiveInt(
  process.env.HELPDESK_MAX_BODY_BYTES,
  DEFAULT_MAX_BODY_BYTES,
  1024,
  256 * 1024
);
const MAX_LLM_TOKENS = parsePositiveInt(
  process.env.HELPDESK_LLM_MAX_TOKENS,
  DEFAULT_MAX_TOKENS,
  64,
  4096
);

let helpdeskRulesPromise: Promise<string> | null = null;

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function getHelpdeskConfig() {
  const apiKey = process.env.HELPDESK_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const baseUrl = process.env.HELPDESK_LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.HELPDESK_LLM_MODEL ?? "gpt-4o-mini";
  return { apiKey, baseUrl, model, maxTokens: MAX_LLM_TOKENS };
}

async function loadHelpdeskRules(): Promise<string> {
  if (helpdeskRulesPromise) {
    return helpdeskRulesPromise;
  }

  helpdeskRulesPromise = (async () => {
    const filePath = path.join(process.cwd(), "agents-helpdesk.md");
    return fs.readFile(filePath, "utf8");
  })();

  return helpdeskRulesPromise;
}

function buildContext(citations: ContextChunk[]): string {
  if (!citations.length) {
    return "[context/none:1-1]\nNo relevant context found in the knowledge base.";
  }

  return citations
    .map((citation) => {
      return `[${citation.path}:${citation.startLine}-${citation.endLine}]\n${citation.text}`;
    })
    .join("\n\n");
}

function extractConfidence(answer: string): "high" | "medium" | "low" {
  const match = answer.match(/confidence\**:\s*(high|medium|low)/i);
  if (!match) {
    return "low";
  }
  const value = match[1].toLowerCase();
  if (value === "high" || value === "medium") {
    return value;
  }
  return "low";
}

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const { apiKey, baseUrl, model, maxTokens } = getHelpdeskConfig();
  if (!apiKey) {
    throw new Error("missing_llm_api_key");
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
      max_tokens: maxTokens,
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

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("llm_response_empty");
  }
  return content;
}

async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number.parseInt(contentLength, 10);
    if (Number.isFinite(length) && length > maxBytes) {
      throw new Error("body_too_large");
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text();
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > maxBytes) {
      throw new Error("body_too_large");
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(buffer);
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const logRequest = (status: number) => {
    const durationMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        requestId,
        status,
        durationMs,
      })
    );
  };

  let rawBody = "";
  try {
    rawBody = await readBodyWithLimit(request, MAX_BODY_BYTES);
  } catch {
    logRequest(413);
    return NextResponse.json({ error: "body_too_large" }, { status: 413 });
  }

  let body: HelpRequest;
  try {
    body = JSON.parse(rawBody) as HelpRequest;
  } catch {
    logRequest(400);
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    logRequest(400);
    return NextResponse.json({ error: "missing_message" }, { status: 400 });
  }

  const diagnostics =
    body.diagnostics && typeof body.diagnostics === "object" ? body.diagnostics : null;

  const { limit, windowMs } = getHelpdeskRateLimitConfig();
  const clientKey = `helpdesk:${getTrustedClientIp(request)}`;
  const rate = await checkTokenBucket(clientKey, limit, windowMs);
  if (!rate.allowed) {
    logRequest(429);
    return NextResponse.json(
      { error: "rate_limited", resetAt: rate.resetAt },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rate.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  try {
    const results = await hybridSearch(message, DEFAULT_TOP_K);
    const citations: ContextChunk[] = results.map((result) => ({
      id: result.entry.id,
      path: result.entry.path,
      startLine: result.entry.startLine,
      endLine: result.entry.endLine,
      score: result.score,
      text: result.entry.text,
    }));

    const rules = await loadHelpdeskRules();
    const context = buildContext(citations);
    const systemPrompt = `${rules}\n\nRetrieved context:\n${context}`;

    let userPrompt = `User message:\n${message}`;
    if (diagnostics) {
      userPrompt += `\n\nDiagnostics:\n${JSON.stringify(diagnostics, null, 2)}`;
    }

    const answer = await callLlm(systemPrompt, userPrompt);
    const confidence = extractConfidence(answer);

    logRequest(200);
    return NextResponse.json({
      answer,
      citations: citations.map(({ text: _text, ...rest }) => rest),
      confidence,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logRequest(500);
    return NextResponse.json({ error: "help_failed", detail: message }, { status: 500 });
  }
}
