/** @type {import('next').NextConfig} */
const defaultBasePath = "/inspecta_deck";
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || defaultBasePath;
const basePath =
  rawBasePath && rawBasePath !== "/"
    ? rawBasePath.replace(/\/$/, "")
    : defaultBasePath;

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

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath,
  assetPrefix: basePath,
  trailingSlash: false,
  experimental: {
    serverComponentsExternalPackages: ["@xenova/transformers", "onnxruntime-node"],
  },
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@xenova/transformers", "onnxruntime-node");
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
