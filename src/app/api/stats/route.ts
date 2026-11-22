import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { normalizeDomain } from "@/lib/domains";
import { errorResponse } from "@/lib/api-response";
import { getRequestLocale } from "@/lib/request-locale";

// 统计：主题进度 / 书目数量 / 完成字数（只做这三项）。
export async function GET() {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const unknownTitle =
      (await getRequestLocale()) === "en" ? "Unknown title" : "未知书名";

    // 并行读取相互独立的表，减少 Supabase 网络往返（单次约 0.6s）。
    // 只有 list_items 依赖 reading_lists，放到第二波。
    const [
      { data: themes },
      { data: lists },
      { data: docs },
      { data: progress },
      { data: chapters },
      { data: annotations },
    ] = await Promise.all([
      supabase
        .from("themes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at"),
      supabase
        .from("reading_lists")
        .select("id, theme_id")
        .eq("user_id", user.id),
      supabase.from("documents").select("id, title, language"),
      supabase
        .from("reading_progress")
        .select("chapter_id, document_id, status, completed_at")
        .eq("user_id", user.id),
      supabase
        .from("chapters")
        .select(
          "id, document_id, word_count_original, word_count_translated_estimate",
        ),
      supabase.from("annotations").select("document_id").eq("user_id", user.id),
    ]);

    const listIds = (lists ?? []).map((l) => l.id);
    const { data: items } = listIds.length
      ? await supabase
          .from("list_items")
          .select("*")
          .in("reading_list_id", listIds)
          .is("deleted_at", null)
          .order("order_index")
      : { data: [] };

    const listByTheme = new Map<string, string>();
    for (const l of lists ?? []) listByTheme.set(l.id, l.theme_id);
    const docById = new Map((docs ?? []).map((d) => [d.id, d]));

    // 每本书的章节进度：抽屉里显示单本完成度
    const doneChapterIds = new Set(
      (progress ?? [])
        .filter((p) => p.status === "completed")
        .map((p) => p.chapter_id),
    );
    const chapterByDoc = new Map<string, { total: number; done: number }>();
    for (const c of chapters ?? []) {
      const cur = chapterByDoc.get(c.document_id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (doneChapterIds.has(c.id)) cur.done += 1;
      chapterByDoc.set(c.document_id, cur);
    }
    const docProgress = (docId: string | null): number | null => {
      if (!docId) return null;
      const c = chapterByDoc.get(docId);
      if (!c || c.total === 0) return null;
      return Math.round((c.done / c.total) * 100);
    };

    // 1. 主题进度：完成项 / 可推进项（跳过与搁置不计入分母）+ 当前推进到哪一项
    const themeStats = (themes ?? []).map((t) => {
      const its = (items ?? []).filter(
        (it) => listByTheme.get(it.reading_list_id) === t.id,
      );
      const tracked = its.filter(
        (it) => it.status !== "skipped" && it.status !== "shelved",
      );
      const completed = tracked.filter((it) => it.status === "completed").length;
      const current = tracked.find(
        (it) => it.status === "unread" || it.status === "in_progress",
      );
      const currentTitle = current
        ? current.document_id
          ? (docById.get(current.document_id)?.title ?? unknownTitle)
          : (current.candidate_metadata?.title ?? unknownTitle)
        : null;
      return {
        id: t.id,
        name: t.name,
        domain: normalizeDomain(t.domain),
        status: t.status ?? "active",
        total: tracked.length,
        completed,
        current_title: currentTitle,
        current_document_id:
          current && current.document_id ? current.document_id : null,
        // 篮子抽屉：这本书在清单里的书名、状态、知识点与进度
        items: its.map((it) => ({
          id: it.id,
          title: it.document_id
            ? (docById.get(it.document_id)?.title ?? unknownTitle)
            : (it.candidate_metadata?.title ?? unknownTitle),
          status: it.status,
          availability: it.availability,
          document_id: it.document_id,
          key_points: Array.isArray(it.candidate_metadata?.key_points)
            ? it.candidate_metadata.key_points
            : [],
          weread: Boolean(it.candidate_metadata?.weread?.bookId),
          weread_progress:
            typeof it.candidate_metadata?.weread?.progress === "number"
              ? it.candidate_metadata.weread.progress
              : null,
          progress: docProgress(it.document_id),
        })),
      };
    });

    // domain 列还没迁移时，前端提示去执行 0008
    const domainReady =
      (themes ?? []).length === 0 ||
      (themes ?? []).some((t) => "domain" in t);
    const unclassified = (themes ?? []).filter(
      (t) => !normalizeDomain(t.domain),
    ).length;


    // 2 & 3. 完成章节 / 完成整本 / 字数（复用上面已并行取回的 chapters）
    const completedProgress = (progress ?? []).filter(
      (p) => p.status === "completed",
    );
    const completedChapterIds = completedProgress.map((p) => p.chapter_id);
    const completedIdSet = new Set(completedChapterIds);
    const completedChapters = (chapters ?? []).filter((c) =>
      completedIdSet.has(c.id),
    );

    const totalByDoc = new Map<string, number>();
    for (const c of chapters ?? []) {
      totalByDoc.set(c.document_id, (totalByDoc.get(c.document_id) ?? 0) + 1);
    }
    const completedByDoc = new Map<string, number>();
    let wordsOriginal = 0;
    let wordsTranslatedEstimate = 0;
    for (const c of completedChapters ?? []) {
      completedByDoc.set(c.document_id, (completedByDoc.get(c.document_id) ?? 0) + 1);
      wordsOriginal += Number(c.word_count_original ?? 0);
      wordsTranslatedEstimate += Number(
        c.word_count_translated_estimate ?? c.word_count_original ?? 0,
      );
    }

    let completedBooks = 0;
    for (const [docId, done] of completedByDoc.entries()) {
      const total = totalByDoc.get(docId) ?? 0;
      if (total > 0 && done >= total) completedBooks += 1;
    }

    // 完成项列表（按主题/书，用于「已读清单」展示与导出）
    const completedAtByDoc = new Map<string, string>();
    for (const p of completedProgress) {
      if (!p.document_id || !p.completed_at) continue;
      const prev = completedAtByDoc.get(p.document_id);
      if (!prev || p.completed_at > prev) completedAtByDoc.set(p.document_id, p.completed_at);
    }

    const completedItems = (items ?? [])
      .filter((it) => it.status === "completed")
      .map((it) => {
        const title = it.document_id
          ? (docById.get(it.document_id)?.title ?? "未知书名")
          : (it.candidate_metadata?.title ?? "未知书名");
        const themeName =
          (themes ?? []).find((t) => t.id === listByTheme.get(it.reading_list_id))
            ?.name ?? "未知主题";
        return {
          id: it.id,
          title,
          theme: themeName,
          completed_at: it.document_id
            ? (completedAtByDoc.get(it.document_id) ?? null)
            : null,
        };
      });

    const noteCounts = new Map<string, number>();
    for (const a of annotations ?? []) {
      noteCounts.set(a.document_id, (noteCounts.get(a.document_id) ?? 0) + 1);
    }
    const noteBooks = [...noteCounts.entries()]
      .map(([id, count]) => ({
        id,
        title: docById.get(id)?.title ?? "未知书籍",
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      themes: themeStats,
      domain_ready: domainReady,
      unclassified,
      books: {
        completed_books: completedBooks,
        completed_chapters: completedChapterIds.length,
      },
      words: {
        original: wordsOriginal,
        translated_estimate: wordsTranslatedEstimate,
      },
      notes: {
        total: (annotations ?? []).length,
        books: noteBooks,
      },
      completed_items: completedItems,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
