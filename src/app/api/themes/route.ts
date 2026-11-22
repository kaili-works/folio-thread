import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

// 列出当前用户的全部主题
export async function GET() {
  const supabase = await createServerSupabase();
  try {
    await requireUser();
    const { data, error } = await supabase
      .from("themes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ themes: data });
  } catch (e) {
    return errorResponse(e);
  }
}

// 创建主题
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const body = await request.json();

    const name = (body?.name as string | undefined)?.trim();
    const description = (body?.description as string | undefined)?.trim() ?? "";
    const dailyBudgetMinutes = Number(body?.daily_budget_minutes) || 30;

    if (!name) throw new ApiError(400, "主题名称不能为空");

    const { data, error } = await supabase
      .from("themes")
      .insert({
        user_id: user.id,
        name,
        description,
        daily_budget_minutes: dailyBudgetMinutes,
        daily_budget_weight: 1.0,
      })
      .select()
      .single();

    if (error || !data) {
      throw new ApiError(500, `创建主题失败：${error?.message ?? "未知错误"}`);
    }

    return NextResponse.json({ theme: data });
  } catch (e) {
    return errorResponse(e);
  }
}
