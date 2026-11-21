import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";

const COLORS = ["yellow", "blue", "green"];

type Context = { params: Promise<{ id: string }> };

// 编辑笔记（评论 / 颜色）
export async function PATCH(req: Request, { params }: Context) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  try {
    await requireUser();

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.comment !== undefined) updates.comment = String(body.comment).trim();
    if (body.color !== undefined && COLORS.includes(body.color)) {
      updates.color = body.color;
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "没有可更新的字段");
    }

    const { data, error } = await supabase
      .from("annotations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      throw new ApiError(404, `更新失败：${error?.message ?? "笔记不存在"}`);
    }

    return NextResponse.json({ annotation: data });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 删除笔记
export async function DELETE(_req: Request, { params }: Context) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  try {
    await requireUser();
    const { error } = await supabase
      .from("annotations")
      .delete()
      .eq("id", id);
    if (error) throw new ApiError(500, `删除失败：${error.message}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
