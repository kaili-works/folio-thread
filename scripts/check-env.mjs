#!/usr/bin/env node
/**
 * 启动自检：缺环境变量时明确报错，而不是等到页面报 500。
 *
 *   node scripts/check-env.mjs        只检查环境变量（predev / prestart 自动执行）
 *   node scripts/check-env.mjs --db   额外检查核心表是否已建（npm run doctor）
 */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

const withDb = process.argv.includes("--db");
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const REQUIRED = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase 项目地址"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon key"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase service_role key"],
];

const OPTIONAL = [
  ["DEEPSEEK_API_KEY", "缺失时清单走规则生成，翻译/归类/知识点不可用"],
  ["WEREAD_API_KEY", "缺失时隐藏微信读书入口"],
  ["EDGE_TTS_PYTHON", "缺失时跳过 Edge TTS"],
  ["AZURE_SPEECH_KEY", "缺失时跳过 Azure 语音"],
];

const TABLES = [
  "profiles",
  "documents",
  "chapters",
  "paragraphs",
  "translations",
  "themes",
  "reading_lists",
  "list_items",
  "reading_progress",
  "annotations",
  "book_note_status",
  "daily_packs",
  "reading_stats",
];

const missing = REQUIRED.filter(([key]) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error("\n[check-env] 缺少必需的环境变量：");
  for (const [key, hint] of missing) console.error(`  - ${key}（${hint}）`);
  console.error("\n请复制 .env.example 为 .env.local 并填写后重试。\n");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
try {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("protocol");
} catch {
  console.error(`\n[check-env] NEXT_PUBLIC_SUPABASE_URL 不是合法 URL：${url}\n`);
  process.exit(1);
}

const missingOptional = OPTIONAL.filter(([key]) => !process.env[key]?.trim());
if (missingOptional.length > 0) {
  console.warn("[check-env] 可选变量未配置（应用仍可启动）：");
  for (const [key, hint] of missingOptional) console.warn(`  - ${key}：${hint}`);
}

if (!withDb) {
  console.log("[check-env] 环境变量检查通过。");
  process.exit(0);
}

const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = await Promise.all(
  TABLES.map(async (table) => {
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
    return { table, error: error?.message ?? null };
  }),
);

const missingTables = results.filter((row) => row.error && /does not exist|schema cache/i.test(row.error));
const unreachable = results.filter((row) => row.error && !missingTables.includes(row));

if (missingTables.length > 0) {
  console.error("\n[check-env] 数据库缺少表：");
  for (const row of missingTables) console.error(`  - ${row.table}`);
  console.error("\n请在 Supabase SQL Editor 中执行 database/init.sql（或按 0001→0008 顺序执行迁移）。\n");
  process.exit(1);
}
if (unreachable.length > 0) {
  console.error("\n[check-env] 无法访问数据库，请检查 URL 与 service_role key：");
  console.error(`  - ${unreachable[0].error}\n`);
  process.exit(1);
}

console.log(`[check-env] 环境变量与 ${TABLES.length} 张核心表检查通过。`);
