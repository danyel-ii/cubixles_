import { execSync } from "node:child_process";
import fs from "node:fs";

const FILES = execSync("git ls-files -z", { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const PATTERNS = [
  {
    name: "env-private-key",
    regex: /\b(PRIVATE_KEY|DEPLOYER_KEY)\b\s*[:=]\s*['"]?0x[a-f0-9]{64}['"]?/i,
  },
  {
    name: "pem-private-key",
    regex: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/,
  },
];

const hits = [];

for (const file of FILES) {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (error) {
    continue;
  }
  if (content.includes("\0")) {
    continue;
  }
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        hits.push({
          file,
          line: i + 1,
          pattern: pattern.name,
        });
      }
    }
  }
}

if (hits.length) {
  console.error("Potential secrets detected in tracked files:");
  for (const hit of hits) {
    console.error(`- ${hit.file}:${hit.line} (${hit.pattern})`);
  }
  process.exit(2);
}

console.log("Repo secret scan passed.");
