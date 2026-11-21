#!/usr/bin/env node
/**
 * 把 database/0001..000N 按文件名顺序合并为 database/init.sql。
 * 新增迁移后执行 `npm run db:init` 重新生成，不要手改 init.sql。
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbDir = join(root, "database");

const files = readdirSync(dbDir)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort();

if (files.length === 0) {
  console.error("[db:init] database/ 下没有 0001_*.sql 迁移文件");
  process.exit(1);
}
if (!files[0].startsWith("0001_")) {
  console.error(`[db:init] 首个迁移不是 0001：${files[0]}`);
  process.exit(1);
}

const header = `-- 由 scripts/build-init-sql.mjs 自动生成，请勿手动编辑。
-- 用法：在 Supabase Dashboard -> SQL Editor 中整段执行。
-- 源文件：${files.join(", ")}
-- 重新生成：npm run db:init
`;

const body = files
  .map((file) => {
    const sql = readFileSync(join(dbDir, file), "utf8").trimEnd();
    return `\n-- ============================================================\n-- ${file}\n-- ============================================================\n\n${sql}\n`;
  })
  .join("");

const output = `${header}${body}`;
writeFileSync(join(dbDir, "init.sql"), output, "utf8");
console.log(`[db:init] 已生成 database/init.sql（${files.length} 个迁移，${output.length} 字符）`);
