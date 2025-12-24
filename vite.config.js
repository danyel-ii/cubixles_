import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  root: "frontend",
  plugins: [
    nodePolyfills({
      include: ["buffer", "process"],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    include: ["buffer", "process"],
  },
});
