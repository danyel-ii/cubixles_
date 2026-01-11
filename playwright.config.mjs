import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
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
        reuseExistingServer: true,
        timeout: 180_000,
        env: {
          NEXT_TELEMETRY_DISABLED: "1",
        },
      };

export default defineConfig({
  testDir: "./tests",
  testMatch: ["smoke.spec.mjs", "e2e/**/*.spec.mjs"],
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL,
    headless: true,
  },
  webServer,
});
