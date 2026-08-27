import fs from "node:fs";
import path from "node:path";

const plan = process.argv[2];
const n = Number(process.argv[3]);
const lines = fs.readFileSync(plan, "utf8").split(/\r?\n/);
let infence = false;
let intask = false;
const out = [];
const heading = new RegExp(`^#+[ \\t]+Task[ \\t]+${n}([^0-9]|$)`);
for (const line of lines) {
  if (line.startsWith("```")) infence = !infence;
  if (!infence && /^#+[ \t]+Task[ \t]+\d+/.test(line)) {
    intask = heading.test(line);
  }
  if (intask) out.push(line);
}
const dir = path.join(".superpowers", "sdd");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, ".gitignore"), "*\n");
const dest = path.join(dir, `task-${n}-brief.md`);
fs.writeFileSync(dest, `${out.join("\n")}\n`);
console.log(`wrote ${dest}: ${out.length} lines`);
