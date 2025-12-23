import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const sourcePath = join(root, "contracts", "out", "IceCubeMinter.sol", "IceCubeMinter.json");
const targetPath = join(root, "contracts", "abi", "IceCubeMinter.json");

const payload = JSON.parse(await readFile(sourcePath, "utf8"));
await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, JSON.stringify(payload.abi, null, 2));

console.log(`ABI exported to ${targetPath}`);
