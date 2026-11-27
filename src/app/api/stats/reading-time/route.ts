import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, assertDocumentOwner, requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

// 阅读时长：GET 聚合、POST 心跳。
// 客户端只报增量，累加与单行封顶在 add_reading_seconds() 里完成。
// 听书另报 source="audio"，不与阅读时长合并统计。
const MAX_SECONDS = 1800; // 单次最多 30 分钟，防止异常客户端一次写入过多
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 时长聚合：今日实际（阅读 / 听书分开）、今日预算、最近 N 天趋势、按书拆分。
// 「今天」以服务端本地日期为准，与 daily_packs 写入时用的是同一套日期。
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const days = Math.min(
      90,
      Math.max(7, Number(new URL(request.url).searchParams.get("days") ?? 30) || 30),
    );

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const since = ymd(start);
    const today = ymd(new Date());

    const [rowsRes, packRes] = await Promise.all([
      supabase
        .from("reading_daily")
        .select("date, seconds, source, document_id")
        .eq("user_id", user.id)
        .gte("date", since),
      supabase
        .from("daily_packs")
        .select("items")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
    ]);

    // 表还没迁移时不要静默返回全 0，否则会被误读成「今天没读」
    if (rowsRes.error) {
      throw new ApiError(500, `读取阅读时长失败：${rowsRes.error.message}`);
    }
    const rows = rowsRes.data;
    const pack = packRes.data;

    const byDay = new Map<string, number>();
    const byDoc = new Map<string, number>();
    let todayRead = 0;
    let todayAudio = 0;
    for (const r of rows ?? []) {
      const secs = Number(r.seconds ?? 0);
      // 听书单独统计，不进入阅读趋势与预算缺口
      if (r.source === "audio") {
        if (r.date === today) todayAudio += secs;
        continue;
      }
      byDay.set(r.date, (byDay.get(r.date) ?? 0) + secs);
      if (r.date === today) todayRead += secs;
      if (r.document_id) {
        byDoc.set(r.document_id, (byDoc.get(r.document_id) ?? 0) + secs);
      }
    }

    // 补齐窗口内的空白日期，前端不必自己算缺省值
    const series: { date: string; seconds: number }[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = ymd(d);
      series.push({ date: key, seconds: byDay.get(key) ?? 0 });
    }

    // 今日预算取「今日阅读包」的合计计划分钟；今天没取包则为 null
    const packItems = Array.isArray(pack?.items) ? pack.items : [];
    const planned = packItems.reduce(
      (sum: number, it: any) => sum + (Number(it?.planned_minutes) || 0),
      0,
    );

    return NextResponse.json({
      today: {
        read_seconds: todayRead,
        audio_seconds: todayAudio,
        planned_minutes: packItems.length > 0 && planned > 0 ? planned : null,
      },
      days: series,
      by_document: [...byDoc.entries()].map(([document_id, seconds]) => ({
        document_id,
        seconds,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const documentId =
      typeof body?.document_id === "string" ? body.document_id : "";
    const date = typeof body?.date === "string" ? body.date : "";
    const source = body?.source === "audio" ? "audio" : "read";
    const seconds = Math.floor(Number(body?.seconds ?? 0));

    if (
      !documentId ||
      !DATE_RE.test(date) ||
      !Number.isFinite(seconds) ||
      seconds <= 0
    ) {
      throw new ApiError(400, "参数不完整");
    }
    if (seconds > MAX_SECONDS) throw new ApiError(400, "上报时长超出上限");

    await assertDocumentOwner(documentId, user.id);

    const { error } = await supabase.rpc("add_reading_seconds", {
      p_document_id: documentId,
      p_date: date,
      p_source: source,
      p_seconds: seconds,
    });
    if (error) throw new ApiError(500, `写入阅读时长失败：${error.message}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
