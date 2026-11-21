import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";

// 更新当前用户阅读速度（字/分钟）
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const speed = Number(body?.reading_speed);

    if (!Number.isFinite(speed) || speed < 100 || speed > 1000) {
      throw new ApiError(400, "阅读速度需在 100~1000 字/分钟之间");
    }

    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("profiles")
      .update({ reading_speed: Math.round(speed) })
      .eq("id", user.id)
      .select()
      .single();

    if (error || !data) {
      throw new ApiError(500, `保存阅读速度失败：${error?.message ?? "未知错误"}`);
    }

    return NextResponse.json({ reading_speed: data.reading_speed });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
