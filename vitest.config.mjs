import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = resolve(fileURLToPath(new URL(".", import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      "src/shared": resolve(rootDir, "app/_client/src/shared"),
    },
  },
  test: {
    include: [
      "tests/unit/**/*.spec.mjs",
      "tests/component/**/*.spec.mjs",
      "tests/api/**/*.spec.mjs",
    ],
    environment: "jsdom",
    environmentMatchGlobs: [["tests/api/**", "node"]],
    setupFiles: ["tests/setup.mjs"],
  },
});
