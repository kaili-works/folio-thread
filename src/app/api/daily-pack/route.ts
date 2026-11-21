import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { generateDailyPack } from "@/lib/daily-pack";

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 获取今天的每日包；当天还没有时按清单与预算直接生成并生效，
// 这样跨过零点后打开页面就是新一天的包，不需要手动点「生成」
export async function GET() {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const date = today();
    const { data, error } = await supabase
      .from("daily_packs")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data) return NextResponse.json({ pack: data });

    const result = await generateDailyPack(user.id, date, { confirm: true });
    return NextResponse.json({ pack: result.pack });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 手动重新生成今天的每日包（直接生效）
export async function POST() {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const result = await generateDailyPack(user.id, today(), {
      confirm: true,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 确认每日包（draft -> confirmed）
export async function PATCH() {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const { data, error } = await supabase
      .from("daily_packs")
      .update({ status: "confirmed" })
      .eq("user_id", user.id)
      .eq("date", today())
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ pack: data });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
