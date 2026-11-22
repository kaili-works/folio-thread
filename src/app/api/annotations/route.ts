import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

const COLORS = ["yellow", "blue", "green"];

// 查询某本书当前用户的全部笔记（RLS 自动限定 user_id）
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("document_id");

  let query = supabase
    .from("annotations")
    .select(
      "id, document_id, chapter_id, paragraph_id, comment, color, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (documentId) query = query.eq("document_id", documentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ annotations: data });
}

// 创建笔记：整段标记 + 评论
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();

    const body = await request.json();
    const paragraphId = body?.paragraph_id as string | undefined;
    const comment = (body?.comment as string | undefined)?.trim() ?? "";
    const color = COLORS.includes(body?.color) ? body.color : "yellow";

    if (!paragraphId) throw new ApiError(400, "缺少段落");

    // 由段落反查章节与书籍
    const { data: para } = await supabase
      .from("paragraphs")
      .select("chapter_id")
      .eq("id", paragraphId)
      .single();
    if (!para) throw new ApiError(404, "段落不存在");

    const { data: chap } = await supabase
      .from("chapters")
      .select("document_id")
      .eq("id", para.chapter_id)
      .single();
    if (!chap) throw new ApiError(404, "章节不存在");

    const { data, error } = await supabase
      .from("annotations")
      .insert({
        user_id: user.id,
        document_id: chap.document_id,
        chapter_id: para.chapter_id,
        paragraph_id: paragraphId,
        comment,
        color,
      })
      .select()
      .single();

    if (error || !data) {
      throw new ApiError(500, `保存笔记失败：${error?.message ?? "未知错误"}`);
    }

    return NextResponse.json({ annotation: data });
  } catch (e) {
    return errorResponse(e);
  }
}
