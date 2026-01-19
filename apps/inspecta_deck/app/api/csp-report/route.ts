import { getTrustedClientIp } from "../../_lib/request";
import { checkTokenBucket } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_RATE_LIMIT = 30;
const DEFAULT_RATE_WINDOW_SECONDS = 60;
const MAX_REPORTS = 20;
const MAX_FIELD_LENGTH = 512;

const ALLOWED_CONTENT_TYPES = new Set([
  "application/csp-report",
  "application/reports+json",
  "application/json",
]);

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function getConfig() {
  const maxBodyBytes = parsePositiveInt(
    process.env.CSP_REPORT_MAX_BYTES,
    DEFAULT_MAX_BODY_BYTES,
    1024,
    1024 * 1024
  );
  const limit = parsePositiveInt(
    process.env.CSP_REPORT_RATE_LIMIT,
    DEFAULT_RATE_LIMIT,
    1,
    500
  );
  const windowSeconds = parsePositiveInt(
    process.env.CSP_REPORT_RATE_WINDOW_SECONDS,
    DEFAULT_RATE_WINDOW_SECONDS,
    1,
    3600
  );

  return {
    maxBodyBytes,
    limit,
    windowMs: windowSeconds * 1000,
  };
}

function normalizeContentType(contentType: string | null) {
  if (!contentType) {
    return null;
  }
  return contentType.split(";")[0]?.trim().toLowerCase() ?? null;
}

function safeString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > MAX_FIELD_LENGTH ? trimmed.slice(0, MAX_FIELD_LENGTH) : trimmed;
}

function sanitizeUrl(value: unknown) {
  const raw = safeString(value);
  if (!raw) {
    return undefined;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return url.protocol;
    }
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return raw.length > MAX_FIELD_LENGTH ? raw.slice(0, MAX_FIELD_LENGTH) : raw;
  }
}

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function getField(report: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in report) {
      return report[key];
    }
  }
  return undefined;
}

function extractReports(payload: unknown): Array<Record<string, unknown>> {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const body = (entry as Record<string, unknown>).body;
        if (body && typeof body === "object") {
          return body as Record<string, unknown>;
        }
        return null;
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
  }
  if (typeof payload === "object") {
    const report = (payload as Record<string, unknown>)["csp-report"];
    if (report && typeof report === "object") {
      return [report as Record<string, unknown>];
    }
    const body = (payload as Record<string, unknown>).body;
    if (body && typeof body === "object") {
      return [body as Record<string, unknown>];
    }
  }
  return [];
}

function sanitizeReport(report: Record<string, unknown>) {
  return {
    documentUri: sanitizeUrl(getField(report, ["document-uri", "documentUri"])),
    referrer: sanitizeUrl(getField(report, ["referrer"])),
    blockedUri: sanitizeUrl(getField(report, ["blocked-uri", "blockedUri"])),
    effectiveDirective: safeString(
      getField(report, ["effective-directive", "effectiveDirective"])
    ),
    violatedDirective: safeString(
      getField(report, ["violated-directive", "violatedDirective"])
    ),
    sourceFile: sanitizeUrl(getField(report, ["source-file", "sourceFile"])),
    lineNumber: coerceNumber(getField(report, ["line-number", "lineNumber"])),
    columnNumber: coerceNumber(getField(report, ["column-number", "columnNumber"])),
    disposition: safeString(getField(report, ["disposition"])),
    statusCode: coerceNumber(getField(report, ["status-code", "statusCode"])),
  };
}

function noContent() {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const { maxBodyBytes, limit, windowMs } = getConfig();
  const contentType = normalizeContentType(request.headers.get("content-type"));
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return noContent();
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number.parseInt(contentLength, 10);
    if (Number.isFinite(length) && length > maxBodyBytes) {
      return noContent();
    }
  }

  const clientKey = `csp:${getTrustedClientIp(request)}`;
  const rate = await checkTokenBucket(clientKey, limit, windowMs);
  if (!rate.allowed) {
    return noContent();
  }

  let payloadText = "";
  try {
    payloadText = await request.text();
  } catch {
    return noContent();
  }

  if (payloadText.length > maxBodyBytes) {
    return noContent();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    return noContent();
  }

  const reports = extractReports(payload).slice(0, MAX_REPORTS);
  if (reports.length) {
    const sanitizedReports = reports.map(sanitizeReport);
    console.log(
      JSON.stringify({
        event: "csp-report",
        count: sanitizedReports.length,
        reports: sanitizedReports,
      })
    );
  }

  return noContent();
}
