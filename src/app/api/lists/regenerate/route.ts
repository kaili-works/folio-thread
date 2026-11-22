import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getAiConfig } from "@/lib/config";
import { findWeReadBook } from "@/lib/weread";
import { getRequestLocale } from "@/lib/request-locale";
import { outputLanguageRule, reasonRules } from "@/lib/ai-locale";
import type { Locale } from "@/i18n";
import { errorResponse } from "@/lib/api-response";
import { tApi } from "@/lib/api-messages";

type Book = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  total_words_original: number | null;
};

type Recommendation = { title: string; author: string; reason: string };

async function callDeepSeek(
  themeName: string,
  description: string,
  hint: string,
  excludeTitles: string[],
  locale: Locale,
): Promise<Recommendation[]> {
  const { key: apiKey, url, model } = getAiConfig();
  if (!apiKey) throw new Error("未配置 AI_API_KEY 或 DEEPSEEK_API_KEY");

  const system =
    "你是阅读规划助手。根据研究主题和用户的一句话提示，推荐一个循序渐进的阅读书目。只输出 JSON，不要任何解释。";

  const exclude = excludeTitles.length
    ? `\n以下书目已在清单里，不要重复推荐：${excludeTitles.join("、")}`
    : "";

  const userPrompt = [
    `研究主题：${themeName}`,
    description ? `主题描述/背景：${description}` : "",
    hint ? `本次调整提示：${hint}` : "",
    "请推荐这个主题下适合循序阅读的书籍，5-6 本。",
    exclude,
    '输出格式：{"books":[{"title":"书名","author":"作者","reason":"推荐理由"}]}',
    ...reasonRules(locale),
    outputLanguageRule(locale),
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`AI 请求失败：HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回为空");

  const parsed = JSON.parse(content);
  const books = Array.isArray(parsed) ? parsed : parsed?.books;
  return Array.isArray(books)
    ? books
        .map((b: any) => ({
          title: (b?.title ?? "").trim(),
          author: (b?.author ?? "").trim(),
          reason: (b?.reason ?? "").trim(),
        }))
        .filter((b: any) => b.title && b.reason)
    : [];
}

function matchBooks(recs: Recommendation[], books: Book[]) {
  return recs.map((r) => {
    const book = books.find(
      (b) =>
        b.title === r.title || b.title.includes(r.title) || r.title.includes(b.title),
    );
    return { recommendation: r, book };
  });
}

// 预览：根据提示重新生成「未开始且未锁定」的项，返回 keep/removed/proposed，不写库
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    if (!rateLimit(`regenerate:${user.id}`, 6, 60_000)) {
      return NextResponse.json(
        { error: tApi(await getRequestLocale(), "重新生成过于频繁，请稍后再试") },
        { status: 429 },
      );
    }
    const body = await request.json();
    const themeId = body?.theme_id as string | undefined;
    const hint = (body?.hint as string | undefined)?.trim() ?? "";
    if (!themeId) throw new ApiError(400, "缺少主题");

    const locale = await getRequestLocale();

    const { data: theme } = await supabase
      .from("themes")
      .select("*")
      .eq("id", themeId)
      .single();
    if (!theme) throw new ApiError(404, "主题不存在");

    const { data: lists } = await supabase
      .from("reading_lists")
      .select("*")
      .eq("theme_id", themeId)
      .order("created_at", { ascending: false })
      .limit(1);
    const list = lists?.[0];
    if (!list) throw new ApiError(400, "还没有清单，先点「生成清单」");

    const { data: items } = await supabase
      .from("list_items")
      .select("*")
      .eq("reading_list_id", list.id)
      .is("deleted_at", null)
      .order("order_index");

    const all = (items ?? []) as any[];
    const keep = all.filter((it) => it.status !== "unread" || it.locked);
    const toRegenerate = all.filter((it) => it.status === "unread" && !it.locked);

    // 收集 keep 项的书名（用于排除，避免重复推荐）
    const keepDocIds = keep.map((it) => it.document_id).filter(Boolean) as string[];
    const { data: keepDocs } = keepDocIds.length
      ? await supabase.from("documents").select("id, title").in("id", keepDocIds)
      : { data: [] };
    const keepTitleById = new Map((keepDocs ?? []).map((d: any) => [d.id, d.title]));
    const excludeTitles = keep
      .map((it) => (it.document_id ? keepTitleById.get(it.document_id) : it.candidate_metadata?.title))
      .filter(Boolean) as string[];

    const { data: booksData } = await supabase
      .from("documents")
      .select("id, title, author, description, total_words_original")
      .order("created_at", { ascending: true });
    const books = (booksData ?? []) as Book[];

    let matched: { recommendation: Recommendation; book?: Book }[] = [];
    for (let attempt = 0; attempt < 2 && matched.length === 0; attempt++) {
      try {
        const recs = await callDeepSeek(
          theme.name,
          theme.description ?? "",
          hint,
          excludeTitles,
          locale,
        );
        if (recs.length > 0) matched = matchBooks(recs, books);
      } catch {
        matched = [];
      }
    }
    if (matched.length === 0) {
      const key = getAiConfig().key;
      throw new ApiError(
        503,
        key
          ? "AI 生成失败，请稍后重试"
          : "未配置 AI_API_KEY 或 DEEPSEEK_API_KEY，无法重新生成清单（见 README 的 AI 配置）",
      );
    }
    // 一次最多替换 6 本，保持清单短、读得完
    matched = matched.slice(0, 6);

    // 库内没有的书顺手查一次微信读书，命中就带上阅读链接
    const wereadHits = await Promise.all(
      matched.map((m) =>
        m.book
          ? Promise.resolve(null)
          : findWeReadBook(m.recommendation.title, m.recommendation.author),
      ),
    );

    const proposed = matched.map((m, i) => {
      const base = {
        reason: m.recommendation.reason,
        estimated_minutes: 30,
        source: m.book ? "library" : "ai_web",
        status: "unread",
        locked: false,
        title: m.recommendation.title,
        author: m.recommendation.author,
      };
      if (m.book) {
        return { ...base, document_id: m.book.id, availability: "readable", candidate_metadata: null };
      }
      const weread = wereadHits[i];
      return {
        ...base,
        document_id: null,
        availability: "pending_supplement",
        candidate_metadata: {
          title: m.recommendation.title,
          author: m.recommendation.author,
          ...(weread
            ? { weread: { bookId: weread.bookId, readerLink: weread.readerLink } }
            : {}),
        },
      };
    });

    return NextResponse.json({
      list_id: list.id,
      keep,
      removed: toRegenerate,
      proposed,
      source: "ai",
      message:
        toRegenerate.length === 0
          ? locale === "en"
            ? "Nothing to regenerate — every item has already been started"
            : "没有可重新生成的未开始项"
          : null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

// 应用 / 撤销：apply 软删除 removed 并插入 proposed；undo 恢复 removed 并删除新插入项
export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  try {
    await requireUser();
    const body = await request.json();
    const listId = body?.list_id as string | undefined;
    if (!listId) throw new ApiError(400, "缺少清单");
    const locale = await getRequestLocale();

    // 撤销：恢复被软删的旧项，并软删新插入项
    if (body?.undo) {
      const restoreIds = (body?.restore_ids as string[] | undefined) ?? [];
      const deleteIds = (body?.delete_ids as string[] | undefined) ?? [];
      for (const id of restoreIds) {
        const { error } = await supabase
          .from("list_items")
          .update({ deleted_at: null })
          .eq("id", id)
          .eq("reading_list_id", listId);
        if (error) throw new ApiError(500, `恢复旧项失败：${error.message}`);
      }
      for (const id of deleteIds) {
        const { error } = await supabase
          .from("list_items")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id)
          .eq("reading_list_id", listId);
        if (error) throw new ApiError(500, `删除新项失败：${error.message}`);
      }
      return NextResponse.json({ ok: true });
    }

    const removedIds = (body?.removed_ids as string[] | undefined) ?? [];
    const newItems = (body?.new_items as any[] | undefined) ?? [];

    // 若前端未传 removed_ids，则服务端重新计算「未开始且未锁定」的项作为被替换项
    let idsToRemove = removedIds;
    if (idsToRemove.length === 0) {
      const { data: curItems } = await supabase
        .from("list_items")
        .select("id, status, locked")
        .eq("reading_list_id", listId)
        .is("deleted_at", null);
      idsToRemove = (curItems ?? [])
        .filter((it: any) => it.status === "unread" && !it.locked)
        .map((it: any) => it.id);
    }

    // 软删除被替换的项
    for (const id of idsToRemove) {
      const { error } = await supabase
        .from("list_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("reading_list_id", listId);
      if (error) throw new ApiError(500, `删除旧项失败：${error.message}`);
    }

    // 取当前最大 order_index，新项从其后追加
    const { data: current } = await supabase
      .from("list_items")
      .select("order_index")
      .eq("reading_list_id", listId)
      .is("deleted_at", null)
      .order("order_index", { ascending: false })
      .limit(1);
    let next = (current?.[0]?.order_index ?? 0) + 1;

    const rows = newItems.map((n: any, i: number) => ({
      reading_list_id: listId,
      order_index: next + i,
      reason: n.reason,
      lang: locale,
      estimated_minutes: n.estimated_minutes ?? 30,
      source: n.source ?? "ai_web",
      status: "unread",
      locked: false,
      document_id: n.document_id ?? null,
      availability: n.availability ?? "pending_supplement",
      candidate_metadata: n.candidate_metadata ?? null,
    }));

    let insertedIds: string[] = [];
    if (rows.length > 0) {
      const { data: inserted, error } = await supabase
        .from("list_items")
        .insert(rows)
        .select("id");
      if (error) throw new ApiError(500, `写入新项失败：${error.message}`);
      insertedIds = (inserted ?? []).map((r: any) => r.id);
    }

    return NextResponse.json({ ok: true, removed_ids: idsToRemove, inserted_ids: insertedIds });
  } catch (e) {
    return errorResponse(e);
  }
}
