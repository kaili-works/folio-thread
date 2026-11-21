import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { ApiError, assertDocumentOwner, requireUser } from "@/lib/auth";
import { removeBookFiles } from "@/lib/book-media";

const BUCKET = "shared";

type Context = { params: Promise<{ id: string }> };

// 书籍详情（仅所有者可读），附带章节与段落统计
export async function GET(_req: Request, { params }: Context) {
  const { id } = await params;
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();

    const { data: doc, error } = await supabase
      .from("documents")
      .select("*, chapters(count)")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!doc) return NextResponse.json({ error: "书籍不存在" }, { status: 404 });
    return NextResponse.json({ document: doc });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 编辑本人书籍的元数据
export async function PATCH(req: Request, { params }: Context) {
  const { id } = await params;
  const admin = createAdminSupabase();
  try {
    const user = await requireUser();
    await assertDocumentOwner(id, user.id);

    const body = await req.json();
    // 白名单：只允许更新这些字段
    const { title, author, description, category, cover_url, language } = body;
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (author !== undefined) updates.author = author;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (cover_url !== undefined) updates.cover_url = cover_url;
    if (language !== undefined) updates.language = language;

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "没有可更新的字段");
    }

    const { data, error } = await admin
      .from("documents")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", user.id)
      .select()
      .single();

    if (error || !data) {
      throw new ApiError(404, `更新失败：${error?.message ?? "书籍不存在"}`);
    }

    return NextResponse.json({ document: data });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 删除本人书籍：先删 Storage 文件，再删 documents（子表由外键级联删除）
export async function DELETE(_req: Request, { params }: Context) {
  const { id } = await params;
  const admin = createAdminSupabase();
  try {
    const user = await requireUser();
    const doc = await assertDocumentOwner(id, user.id);

    // 兼容历史路径（{docId}/...）与新路径（users/{uid}/{docId}/...）
    const basePaths = [`users/${user.id}/${id}`];
    if (doc.file_path) {
      const dir = doc.file_path.split("/").slice(0, -1).join("/");
      if (dir) basePaths.push(dir);
    }
    await removeBookFiles(admin, BUCKET, [...new Set(basePaths)]);

    const { error } = await admin
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) throw new ApiError(500, `删除失败：${error.message}`);

    // 清掉每日包里引用该书的条目，否则今日页会残留「未知书名」
    const { data: packs } = await admin
      .from("daily_packs")
      .select("id, items")
      .eq("user_id", user.id);
    for (const pack of packs ?? []) {
      const items = (pack.items ?? []) as { document_id?: string }[];
      const kept = items.filter((it) => it.document_id !== id);
      if (kept.length === items.length) continue;
      if (kept.length === 0) {
        await admin.from("daily_packs").delete().eq("id", pack.id);
      } else {
        await admin
          .from("daily_packs")
          .update({ items: kept })
          .eq("id", pack.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
