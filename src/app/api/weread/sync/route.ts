import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { getWeReadProgress, wereadTodayPct } from "@/lib/weread";
import type { WeReadProgress } from "@/lib/weread";

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 同步清单里微信读书书籍的进度：满 100% 自动标记读完
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const listId = body?.list_id as string | undefined;

    let listQuery = supabase
      .from("reading_lists")
      .select("id")
      .eq("user_id", user.id);
    if (listId) listQuery = listQuery.eq("id", listId);
    const { data: lists } = await listQuery;
    const listIds = (lists ?? []).map((l) => l.id);
    if (listIds.length === 0) {
      return NextResponse.json({ checked: 0, changed: 0 });
    }

    const { data: items } = await supabase
      .from("list_items")
      .select("id, status, candidate_metadata")
      .in("reading_list_id", listIds)
      .in("status", ["unread", "in_progress"])
      .is("deleted_at", null);

    const now = Date.now();
    const targets = (items ?? []).filter((it: any) => {
      const weread = it.candidate_metadata?.weread;
      if (!weread?.bookId) return false;
      if (!weread.synced_at) return true;
      return now - new Date(weread.synced_at).getTime() > SYNC_INTERVAL_MS;
    });

    let changed = 0;
    const snapshots = new Map<string, WeReadProgress>();
    await Promise.all(
      targets.map(async (it: any) => {
        const weread = it.candidate_metadata.weread;
        const p = await getWeReadProgress(weread.bookId);
        if (!p) return;
        snapshots.set(weread.bookId, p);

        // 书目状态只看全书进度：只有真读完整本才标 completed
        const nextStatus = p.finished
          ? "completed"
          : p.readingSeconds > 0
            ? "in_progress"
            : it.status;

        const { error } = await supabase
          .from("list_items")
          .update({
            status: nextStatus,
            candidate_metadata: {
              ...it.candidate_metadata,
              weread: {
                ...weread,
                progress: p.bookProgress ?? weread.progress ?? 0,
                reading_seconds: p.readingSeconds,
                book_progress: p.bookProgress,
                synced_at: new Date().toISOString(),
              },
            },
          })
          .eq("id", it.id);
        if (!error && (nextStatus !== it.status || p.readingSeconds > 0)) {
          changed += 1;
        }
      }),
    );

    // 今日包是快照，按最新累计时长重算其中微信读书条目的今日进度
    let packUpdated = false;
    const { data: pack } = await supabase
      .from("daily_packs")
      .select("id, items")
      .eq("user_id", user.id)
      .eq("date", today())
      .maybeSingle();

    if (pack) {
      const now = new Date().toISOString();
      const items = ((pack.items ?? []) as Record<string, any>[]).map((it) => {
        const weread = it.weread as Record<string, any> | undefined;
        const p = weread?.bookId ? snapshots.get(weread.bookId) : undefined;
        if (!weread || !p) return it;
        // 老包没有基线时，以本次同步为起点，避免历史阅读量一次冲满
        const baseline =
          typeof weread.baseline_seconds === "number"
            ? weread.baseline_seconds
            : p.readingSeconds;
        const planned = Number(it.planned_minutes) || 30;
        packUpdated = true;
        return {
          ...it,
          weread: {
            ...weread,
            baseline_seconds: baseline,
            reading_seconds: p.readingSeconds,
            book_progress: p.bookProgress,
            today_minutes: Math.max(
              0,
              Math.round((p.readingSeconds - baseline) / 60),
            ),
            today_pct: wereadTodayPct(p.readingSeconds, baseline, planned),
            synced_at: now,
          },
        };
      });
      if (packUpdated) {
        await supabase
          .from("daily_packs")
          .update({ items })
          .eq("id", pack.id)
          .eq("user_id", user.id);
      }
    }

    return NextResponse.json({
      checked: targets.length,
      changed,
      pack_updated: packUpdated,
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
