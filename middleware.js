import { NextResponse } from "next/server";

const DEFAULT_FRAME_ANCESTORS =
  "'self' https://warpcast.com https://*.warpcast.com https://farcaster.xyz https://*.farcaster.xyz";
const CSP_REPORT_GROUP = "csp-endpoint";
const CSP_REPORT_MAX_AGE = 10886400;

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function buildCsp({ nonce, frameAncestors, isProd, reportUri, reportTo, includeUpgrade }) {
  const scriptSrc = ["'self'", "https://cdn.jsdelivr.net", "https://vercel.live"];
  if (isProd && nonce) {
    scriptSrc.push(`'nonce-${nonce}'`);
  }
  if (!isProd) {
    scriptSrc.push("'unsafe-eval'", "'unsafe-inline'");
  }
  const scriptSrcElem = [...scriptSrc];

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    "object-src 'none'",
    "frame-src 'self' https://vercel.live https://verify.walletconnect.org",
    `script-src ${scriptSrc.join(" ")}`,
    `script-src-elem ${scriptSrcElem.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com https:",
    "connect-src 'self' https: wss: data: blob:",
    ...(includeUpgrade ? ["upgrade-insecure-requests"] : []),
  ];

  if (reportTo) {
    directives.push(`report-to ${reportTo}`);
  }
  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join("; ");
}

function buildReportTo(url) {
  return JSON.stringify({
    group: CSP_REPORT_GROUP,
    max_age: CSP_REPORT_MAX_AGE,
    endpoints: [{ url }],
  });
}

export function middleware(request) {
  const nonce = createNonce();
  const frameAncestors = process.env.FRAME_ANCESTORS || DEFAULT_FRAME_ANCESTORS;
  const reportUri = "/api/csp-report";
  const reportUrl = new URL(reportUri, request.nextUrl.origin).toString();
  const isProd =
    process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
  const csp = buildCsp({
    nonce,
    frameAncestors,
    isProd,
    includeUpgrade: true,
  });
  const reportOnlyCsp = buildCsp({
    nonce,
    frameAncestors,
    isProd,
    reportUri,
    reportTo: CSP_REPORT_GROUP,
    includeUpgrade: false,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("content-security-policy-report-only", reportOnlyCsp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Content-Security-Policy-Report-Only", reportOnlyCsp);
  response.headers.set("Reporting-Endpoints", `${CSP_REPORT_GROUP}="${reportUrl}"`);
  response.headers.set("Report-To", buildReportTo(reportUrl));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|inspecta_deck|landing_page).*)"],
};
