import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const defaultPort = process.env.PLAYWRIGHT_PORT || "3100";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${defaultPort}`;
const baseUrl = new URL(baseURL);
const webServerHost = baseUrl.hostname;
const webServerPort =
  baseUrl.port || (baseUrl.protocol === "https:" ? "443" : "80");
const webServerUrl = process.env.PLAYWRIGHT_WEB_SERVER_URL || baseURL;
const webServer =
  process.env.PLAYWRIGHT_NO_SERVER === "1"
    ? undefined
    : {
        command: `npm run dev -- --hostname ${webServerHost} --port ${webServerPort}`,
        url: webServerUrl,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1" && !isCI,
        timeout: 240_000,
        stdout: "inherit",
        stderr: "inherit",
        env: {
          NEXT_TELEMETRY_DISABLED: "1",
        },
      };

export default defineConfig({
  testDir: "./tests",
  testMatch: ["smoke.spec.mjs", "e2e/**/*.spec.mjs"],
  timeout: 60_000,
  retries: 0,
  reporter: isCI ? "line" : "list",
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer,
});
