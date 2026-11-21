// 文案硬编码扫描：统计 src 下仍含中文字面量的文件与行数，作为 i18n 完成度度量。
// 只做统计，不阻断构建。整行注释与 JSDoc 会被跳过，避免注释里的中文虚增指标。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EXT = new Set([".ts", ".tsx"]);
const CJK = /[\u4e00-\u9fa5]/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXT.has(entry.slice(entry.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

function scanFile(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let inBlock = false;
  let count = 0;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes("*/")) inBlock = false;
      return;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlock = true;
      return;
    }
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    const hits = line.match(new RegExp(CJK, "g"));
    if (hits) count += hits.length;
  });
  return count;
}

const rows = walk(SRC)
  .map((file) => ({ file: relative(ROOT, file), count: scanFile(file) }))
  .filter((row) => row.count > 0)
  .sort((a, b) => b.count - a.count);

const total = rows.reduce((sum, row) => sum + row.count, 0);
for (const row of rows) console.log(`${String(row.count).padStart(5)}  ${row.file}`);
console.log(`\n${rows.length} 个文件，共 ${total} 处中文字面量`);
