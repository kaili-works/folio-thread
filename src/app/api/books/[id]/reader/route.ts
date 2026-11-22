import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { ApiError, assertDocumentOwner, requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

const BUCKET = "shared";

type Context = { params: Promise<{ id: string }> };

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// 阅读器聚合接口：一次请求返回书籍、章节目录、今日切片与指定章节的正文/批注/完成状态。
// 移动端原先在浏览器里直连 Supabase 发多次请求，弱网下首屏要等很久；
// 改由服务端聚合后，手机只需经 Tailscale 访问应用本身一次。
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const admin = createAdminSupabase();
  try {
    const user = await requireUser();
    await assertDocumentOwner(id, user.id);
    const chapterId = new URL(request.url).searchParams.get("chapter");

    const [docRes, chapterListRes, progressRes, packRes] = await Promise.all([
      admin.from("documents").select("*").eq("id", id).maybeSingle(),
      admin
        .from("chapters")
        .select("id, title, order_index, depth")
        .eq("document_id", id)
        .order("order_index"),
      admin
        .from("reading_progress")
        .select("chapter_id")
        .eq("user_id", user.id)
        .eq("document_id", id)
        .eq("status", "completed"),
      admin
        .from("daily_packs")
        .select("items")
        .eq("user_id", user.id)
        .eq("date", today())
        .maybeSingle(),
    ]);

    if (docRes.error) throw new ApiError(500, docRes.error.message);
    if (!docRes.data) throw new ApiError(404, "书籍不存在");

    const items = (packRes.data?.items ?? []) as {
      document_id?: string;
      chapter_ids?: string[];
      chapter_start?: number;
      chapter_end?: number;
    }[];
    const mine = items.find(
      (it) =>
        it.document_id === id &&
        Array.isArray(it.chapter_ids) &&
        it.chapter_ids.length > 0,
    );

    const chapterList = chapterListRes.data ?? [];
    const todayItem = mine ?? null;
    // 封面签名与章节查询并行，避免串行多等一次往返
    const coverSigning = docRes.data.cover_url
      ? admin.storage
          .from(BUCKET)
          .createSignedUrl(docRes.data.cover_url, 3600)
      : Promise.resolve({ data: null } as any);
    // 未指定章节时由服务端决定默认打开的章节，客户端首屏只需一次请求
    const effectiveChapterId =
      chapterId ?? todayItem?.chapter_ids?.[0] ?? chapterList[0]?.id ?? null;

    let chapterPayload = null;
    if (effectiveChapterId) {
      const [chRes, pRes, noteRes, statusRes] = await Promise.all([
        admin
          .from("chapters")
          .select("*")
          .eq("id", effectiveChapterId)
          .eq("document_id", id)
          .maybeSingle(),
        admin
          .from("paragraphs")
          .select("*")
          .eq("chapter_id", effectiveChapterId)
          .order("order_index"),
        admin
          .from("annotations")
          .select("id, paragraph_id, comment, color")
          .eq("chapter_id", effectiveChapterId)
          .eq("user_id", user.id),
        admin
          .from("reading_progress")
          .select("status")
          .eq("user_id", user.id)
          .eq("chapter_id", effectiveChapterId)
          .maybeSingle(),
      ]);

      const paragraphs = pRes.data ?? [];
      const imagePaths = [
        ...new Set(
          paragraphs
            .map((p: any) => p.image_path)
            .filter((p: unknown): p is string => typeof p === "string" && !!p),
        ),
      ];
      const imageUrls: Record<string, string> = {};
      await Promise.all(
        imagePaths.map(async (path) => {
          const { data } = await admin.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);
          if (data?.signedUrl) imageUrls[path] = data.signedUrl;
        }),
      );

      chapterPayload = {
        chapter: chRes.data ?? null,
        paragraphs,
        notes: noteRes.data ?? [],
        completed: statusRes.data?.status === "completed",
        image_urls: imageUrls,
      };
    }

    const coverSigned = await coverSigning;
    const coverUrl: string | null = coverSigned?.data?.signedUrl ?? null;

    return NextResponse.json({
      document: docRes.data,
      chapters: chapterList,
      completed_chapter_ids: (progressRes.data ?? []).map(
        (p: any) => p.chapter_id,
      ),
      today_item: todayItem,
      cover_url: coverUrl,
      opened_chapter_id: effectiveChapterId,
      chapter: chapterPayload,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
