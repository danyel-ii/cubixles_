/** @type {import('next').NextConfig} */
const defaultBasePath = "/inspecta_deck";
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || defaultBasePath;
const basePath =
  rawBasePath && rawBasePath !== "/"
    ? rawBasePath.replace(/\/$/, "")
    : defaultBasePath;

const nextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
