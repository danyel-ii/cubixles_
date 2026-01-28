import { resolve } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@napi-rs/canvas", "gif-encoder-2"],
  experimental: {
    turbo: {
      resolveAlias: {
        "src/shared": resolve("./app/_client/src/shared"),
      },
    },
  },
  async redirects() {
    return [
      {
        source: "/palette_cycle_512.gif",
        destination: "/assets/palette_cycle_512.gif",
        permanent: false,
      },
    ];
  },
  async headers() {
    const securityHeaders = [
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
