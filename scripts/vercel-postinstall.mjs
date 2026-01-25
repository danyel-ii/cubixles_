import { execSync } from "node:child_process";

if (process.env.VERCEL) {
  execSync("npm run build:cubixles_scape", { stdio: "inherit" });
}
