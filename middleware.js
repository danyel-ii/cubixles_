import { NextResponse } from "next/server";

const DEFAULT_FRAME_ANCESTORS =
  "'self' https://warpcast.com https://*.warpcast.com https://farcaster.xyz https://*.farcaster.xyz";

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function buildCsp({ nonce, frameAncestors, isProd }) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "https://cdn.jsdelivr.net",
    "https://vercel.live",
  ];
  if (!isProd) {
    scriptSrc.push("'unsafe-eval'", "'unsafe-inline'");
  }
  const scriptSrcElem = [...scriptSrc];

  return [
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
    "connect-src 'self' https: wss:",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function middleware() {
  const nonce = createNonce();
  const frameAncestors = process.env.FRAME_ANCESTORS || DEFAULT_FRAME_ANCESTORS;
  const csp = buildCsp({
    nonce,
    frameAncestors,
    isProd: process.env.NODE_ENV === "production",
  });

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
