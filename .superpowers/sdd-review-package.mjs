import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2];
const head = process.argv[3];
const dir = path.join(".superpowers", "sdd");
fs.mkdirSync(dir, { recursive: true });
const base7 = execSync(`git rev-parse --short ${base}`, { encoding: "utf8" }).trim();
const head7 = execSync(`git rev-parse --short ${head}`, { encoding: "utf8" }).trim();
const out = path.join(dir, `review-${base7}..${head7}.diff`);
const commits = execSync(`git log --oneline ${base}..${head}`, { encoding: "utf8" });
const stat = execSync(`git diff --stat ${base}..${head}`, { encoding: "utf8" });
const diff = execSync(`git diff -U10 ${base}..${head}`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
const body = `# Review package: ${base}..${head}\n\n## Commits\n${commits}\n## Files changed\n${stat}\n## Diff\n${diff}`;
fs.writeFileSync(out, body);
const count = execSync(`git rev-list --count ${base}..${head}`, { encoding: "utf8" }).trim();
console.log(`wrote ${out}: ${count} commit(s), ${Buffer.byteLength(body)} bytes`);
