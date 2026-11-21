import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { normalizeDomain } from "@/lib/domains";

type Context = { params: Promise<{ id: string }> };

// 编辑主题
export async function PATCH(req: Request, { params }: Context) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  try {
    await requireUser();

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.description !== undefined) {
      updates.description = String(body.description).trim();
    }
    if (body.daily_budget_minutes !== undefined) {
      updates.daily_budget_minutes = Number(body.daily_budget_minutes) || 30;
    }
    if (body.daily_budget_weight !== undefined) {
      updates.daily_budget_weight = Number(body.daily_budget_weight) || 1.0;
    }
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!["active", "priority", "shelved"].includes(status)) {
        throw new ApiError(400, "无效的主题状态");
      }
      updates.status = status;
    }
    if (body.domain !== undefined) {
      if (body.domain === null || body.domain === "") {
        updates.domain = null;
      } else {
        const domain = normalizeDomain(body.domain);
        if (!domain) throw new ApiError(400, "无效的领域标签");
        updates.domain = domain;
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "没有可更新的字段");
    }

    const { data, error } = await supabase
      .from("themes")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      throw new ApiError(404, `更新失败：${error?.message ?? "主题不存在"}`);
    }

    return NextResponse.json({ theme: data });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 删除主题（级联删除其清单和清单项）
export async function DELETE(_req: Request, { params }: Context) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  try {
    await requireUser();
    const { error } = await supabase
      .from("themes")
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
