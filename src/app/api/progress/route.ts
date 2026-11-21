import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";

// 完成本章：写 reading_progress，并按完成情况推进清单项状态。
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const body = await request.json();
    const chapterId = body?.chapter_id as string | undefined;
    if (!chapterId) throw new ApiError(400, "缺少章节");

    const { data: chapter } = await supabase
      .from("chapters")
      .select("id, document_id")
      .eq("id", chapterId)
      .single();
    if (!chapter) throw new ApiError(404, "章节不存在");

    // 写完成进度（唯一约束 user_id + chapter_id）
    const { error: progErr } = await supabase.from("reading_progress").upsert(
      {
        user_id: user.id,
        document_id: chapter.document_id,
        chapter_id: chapterId,
        status: "completed",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,chapter_id" },
    );
    if (progErr) throw new ApiError(500, `写入进度失败：${progErr.message}`);

    // 判断该书是否所有章节都已完成
    const { data: allChapters } = await supabase
      .from("chapters")
      .select("id")
      .eq("document_id", chapter.document_id);
    const { data: progress } = await supabase
      .from("reading_progress")
      .select("chapter_id, status")
      .eq("user_id", user.id)
      .eq("document_id", chapter.document_id);
    const completedSet = new Set(
      (progress ?? [])
        .filter((p) => p.status === "completed")
        .map((p) => p.chapter_id),
    );
    const bookCompleted =
      (allChapters ?? []).length > 0 &&
      (allChapters ?? []).every((c) => completedSet.has(c.id));

    // 更新该用户清单里引用此书的项状态（unread/in_progress → in_progress/completed）
    const { data: lists } = await supabase
      .from("reading_lists")
      .select("id")
      .eq("user_id", user.id);
    const listIds = (lists ?? []).map((l) => l.id);
    if (listIds.length > 0) {
      await supabase
        .from("list_items")
        .update({ status: bookCompleted ? "completed" : "in_progress" })
        .in("reading_list_id", listIds)
        .eq("document_id", chapter.document_id)
        .is("deleted_at", null)
        .in("status", ["unread", "in_progress"]);
    }

    return NextResponse.json({ ok: true, bookCompleted });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
