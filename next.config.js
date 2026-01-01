/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const frameAncestors =
      process.env.FRAME_ANCESTORS ||
      "'self' https://warpcast.com https://*.warpcast.com https://farcaster.xyz https://*.farcaster.xyz";
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          `frame-ancestors ${frameAncestors}`,
          "object-src 'none'",
          "frame-src 'self' https://vercel.live",
          "frame-src-elem 'self' https://vercel.live",
          "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://vercel.live",
          "script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://vercel.live",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com https:",
          "connect-src 'self' https: wss:",
          "upgrade-insecure-requests",
        ].join("; "),
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
