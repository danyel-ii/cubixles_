const MAX_BODY_BYTES = 10_000;

function summarizeReport(report) {
  return {
    documentUri: report["document-uri"],
    blockedUri: report["blocked-uri"],
    violatedDirective: report["violated-directive"],
    effectiveDirective: report["effective-directive"],
    sourceFile: report["source-file"],
    lineNumber: report["line-number"],
    columnNumber: report["column-number"],
    statusCode: report["status-code"],
    disposition: report["disposition"],
  };
}

export async function POST(request) {
  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch (error) {
    console.warn("CSP report read failed.", error);
    return new Response(null, { status: 204 });
  }

  if (bodyText.length > MAX_BODY_BYTES) {
    bodyText = bodyText.slice(0, MAX_BODY_BYTES);
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch (error) {
    console.warn("CSP report JSON parse failed.", error);
    return new Response(null, { status: 204 });
  }

  const report = payload?.["csp-report"] || payload?.body;
  if (report && typeof report === "object") {
    console.warn("CSP violation report.", summarizeReport(report));
  } else {
    console.warn("CSP violation report (unrecognized payload).");
  }

  return new Response(null, { status: 204 });
}

export async function GET() {
  return new Response("ok", { status: 200 });
}
