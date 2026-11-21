import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 手动记录「今天在这本书上读了多少分钟」（接口读不到阅读时长时的兜底）
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const listItemId = String(body.list_item_id ?? "");
    if (!listItemId || body.minutes === undefined) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const { data: pack, error: packError } = await supabase
      .from("daily_packs")
      .select("id, items")
      .eq("user_id", user.id)
      .eq("date", today())
      .maybeSingle();
    if (packError) {
      return NextResponse.json({ error: packError.message }, { status: 500 });
    }
    if (!pack) {
      return NextResponse.json({ error: "今天还没有每日包" }, { status: 404 });
    }

    const items = (pack.items ?? []) as Record<string, any>[];
    const target = items.find((it) => it.list_item_id === listItemId);
    if (!target?.weread) {
      return NextResponse.json({ error: "该条目不是微信读书书目" }, { status: 404 });
    }

    const planned = Number(target.planned_minutes) || 30;
    const minutes = Math.max(
      0,
      Math.min(planned, Math.round(Number(body.minutes ?? 0))),
    );
    const todayPct = Math.min(100, Math.round((minutes / planned) * 100));

    const nextItems = items.map((it) =>
      it.list_item_id === listItemId
        ? {
            ...it,
            weread: {
              ...it.weread,
              today_minutes: minutes,
              today_pct: todayPct,
            },
          }
        : it,
    );

    const { error: updateError } = await supabase
      .from("daily_packs")
      .update({ items: nextItems })
      .eq("id", pack.id)
      .eq("user_id", user.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, minutes, today_pct: todayPct });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
