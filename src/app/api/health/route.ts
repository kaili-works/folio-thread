import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const CORE_TABLES = ["profiles", "documents", "daily_packs"];

/**
 * 部署自检端点，供 Docker healthcheck 与手工排查使用。
 *   GET /api/health        只检查环境变量
 *   GET /api/health?db=1   额外检查核心表
 * 不返回任何密钥内容。
 */
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("db") === "1";
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, stage: "env", missing }, { status: 503 });
  }
  if (!deep) {
    return NextResponse.json({ ok: true, stage: "env", hint: "加 ?db=1 检查核心表" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const checks = await Promise.all(
    CORE_TABLES.map(async (table) => {
      const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
      return { table, error: error?.message ?? null };
    }),
  );
  const failed = checks.filter((row) => row.error);
  if (failed.length > 0) {
    return NextResponse.json({ ok: false, stage: "database", failed }, { status: 503 });
  }
  return NextResponse.json({ ok: true, stage: "database", checked: CORE_TABLES });
}
