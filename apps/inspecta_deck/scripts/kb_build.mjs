import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "kb");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "index.jsonl");

// KB allowlist aligned with agents-helpdesk.md
const ALLOW_DIRS = [
  "docs",
  "app",
  path.join("contracts", "src"),
  path.join("contracts", "test"),
];
const ALLOW_FILES = [
  "SPEC.md",
  "STATE_OF_REVIEW.md",
  "RELEASE.md",
  "FORK_TESTING.md",
];

const DENY_DIRS = new Set(["node_modules", ".next", "out", "dist"]);
const DENY_PREFIXES = [".env"];
const DENY_CONTAINS = ["secrets", "credentials"];

const MARKDOWN_EXTS = new Set([".md", ".mdx"]);
const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".json"]);

const MAX_DOC_LINES = 120;
const MAX_CODE_LINES = 160;
const MAX_OTHER_LINES = 200;

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isDenied(relPath) {
  const segments = relPath.split(path.sep);
  if (segments.some((segment) => DENY_DIRS.has(segment))) {
    return true;
  }
  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  if (lowerSegments.some((segment) => DENY_CONTAINS.some((word) => segment.startsWith(word)))) {
    return true;
  }
  const base = segments[segments.length - 1];
  if (DENY_PREFIXES.some((prefix) => base.startsWith(prefix))) {
    return true;
  }
  return false;
}

async function statSafe(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
}

async function walkDir(dirPath, files) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(ROOT, fullPath);
    if (isDenied(relPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      await walkDir(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

async function collectFiles() {
  const files = [];

  for (const dir of ALLOW_DIRS) {
    const fullDir = path.join(ROOT, dir);
    const stat = await statSafe(fullDir);
    if (!stat || !stat.isDirectory()) {
      continue;
    }
    await walkDir(fullDir, files);
  }

  for (const file of ALLOW_FILES) {
    const fullPath = path.join(ROOT, file);
    const stat = await statSafe(fullPath);
    if (!stat || !stat.isFile()) {
      continue;
    }
    const relPath = path.relative(ROOT, fullPath);
    if (!isDenied(relPath)) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function isHeading(line) {
  return /^#{1,6}\s+/.test(line);
}

function isCodeBoundary(line) {
  return (
    /^(export\s+)?(async\s+)?function\s+\w+/.test(line) ||
    /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/.test(line) ||
    /^(export\s+)?class\s+\w+/.test(line) ||
    /^(export\s+)?(type|interface|enum)\s+\w+/.test(line)
  );
}

function splitByMaxLines(start, end, maxLines) {
  const ranges = [];
  for (let cursor = start; cursor <= end; cursor += maxLines) {
    ranges.push({
      start: cursor,
      end: Math.min(cursor + maxLines - 1, end),
    });
  }
  return ranges;
}

function chunkMarkdown(lines) {
  const ranges = [];
  let start = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (i !== 0 && isHeading(lines[i])) {
      ranges.push({ start, end: i - 1 });
      start = i;
    }
  }
  ranges.push({ start, end: Math.max(lines.length - 1, 0) });

  return ranges.flatMap((range) => splitByMaxLines(range.start, range.end, MAX_DOC_LINES));
}

function chunkCode(lines) {
  const boundaries = new Set();
  lines.forEach((line, index) => {
    if (isCodeBoundary(line)) {
      boundaries.add(index);
    }
  });

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  if (sorted[0] !== 0) {
    sorted.unshift(0);
  }

  const ranges = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const start = sorted[i];
    const end = i + 1 < sorted.length ? sorted[i + 1] - 1 : lines.length - 1;
    if (start <= end) {
      ranges.push({ start, end });
    }
  }

  if (!ranges.length) {
    ranges.push({ start: 0, end: Math.max(lines.length - 1, 0) });
  }

  return ranges.flatMap((range) => splitByMaxLines(range.start, range.end, MAX_CODE_LINES));
}

function chunkOther(lines) {
  return splitByMaxLines(0, Math.max(lines.length - 1, 0), MAX_OTHER_LINES);
}

function buildChunks(relPath, content) {
  const lines = content.split(/\r?\n/);
  const ext = path.extname(relPath).toLowerCase();

  let ranges = [];
  if (MARKDOWN_EXTS.has(ext)) {
    ranges = chunkMarkdown(lines);
  } else if (CODE_EXTS.has(ext)) {
    ranges = chunkCode(lines);
  } else {
    ranges = chunkOther(lines);
  }

  return ranges
    .map((range) => {
      const text = lines.slice(range.start, range.end + 1).join("\n");
      if (!text.trim()) {
        return null;
      }
      return {
        id: `${toPosixPath(relPath)}:${range.start + 1}-${range.end + 1}`,
        path: toPosixPath(relPath),
        startLine: range.start + 1,
        endLine: range.end + 1,
        text,
      };
    })
    .filter(Boolean);
}

async function readFileText(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  if (content.includes("\u0000")) {
    return null;
  }
  return content;
}

async function main() {
  const files = await collectFiles();
  const chunks = [];

  for (const filePath of files) {
    const relPath = path.relative(ROOT, filePath);
    const content = await readFileText(filePath);
    if (!content) {
      continue;
    }
    chunks.push(...buildChunks(relPath, content));
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const payload = `${chunks.map((chunk) => JSON.stringify(chunk)).join("\n")}\n`;
  await fs.writeFile(OUTPUT_FILE, payload, "utf8");

  console.log(`kb_build: ${files.length} files, ${chunks.length} chunks -> ${toPosixPath(path.relative(ROOT, OUTPUT_FILE))}`);
}

main().catch((error) => {
  console.error("kb_build failed:", error);
  process.exit(1);
});
