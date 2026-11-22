import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getAiConfig } from "@/lib/config";
import { getRequestLocale } from "@/lib/request-locale";
import { keyPointRules, outputLanguageRule } from "@/lib/ai-locale";
import type { Locale } from "@/i18n";
import { errorResponse } from "@/lib/api-response";
import { tApi } from "@/lib/api-messages";

type Item = {
  id: string;
  order_index: number;
  document_id: string | null;
  candidate_metadata: { title?: string; author?: string; key_points?: string[] } | null;
};

type BookPayload = {
  i: number;
  title: string;
  author: string;
  chapters: string[];
};

// 让 AI 为每本书提炼 3 个知识点标签；优先参考章节标题，没有章节时按书名的核心概念提炼。
async function callDeepSeek(books: BookPayload[], locale: Locale) {
  const { key: apiKey, url, model } = getAiConfig();
  if (!apiKey) throw new Error("未配置 AI_API_KEY 或 DEEPSEEK_API_KEY");

  const system = [
    "你是阅读助教。为每本书提炼知识点标签，用来在阅读路径上标注这本书会讲到的核心概念。",
    "只输出 JSON，不要任何解释。",
  ].join("\n");

  const userPrompt = [
    "书单如下（chapters 是可参考的章节标题；为空时按这本书广为人知的核心概念提炼）：",
    JSON.stringify(books),
    ...keyPointRules(locale),
    outputLanguageRule(locale),
    '输出格式：{"books":[{"i":1,"points":["…","…","…"]}]}',
  ].join("\n");

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
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`AI 请求失败：HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回为空");

  const parsed = JSON.parse(content);
  const rows = Array.isArray(parsed) ? parsed : parsed?.books;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((r: any) => ({
      i: Number(r?.i),
      points: Array.isArray(r?.points)
        ? r.points
            .map((p: any) => String(p).trim())
            .filter(Boolean)
            .slice(0, 4)
        : [],
    }))
    .filter((r) => Number.isFinite(r.i) && r.points.length > 0);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    if (!rateLimit(`keypoints:${user.id}`, 3, 60_000)) {
      return NextResponse.json(
        { error: tApi(await getRequestLocale(), "提炼过于频繁，请稍后再试") },
        { status: 429 },
      );
    }
    const body = await request.json().catch(() => ({}));
    const listId = body?.list_id as string | undefined;
    if (!listId) throw new ApiError(400, "缺少清单");

    const { data: list } = await supabase
      .from("reading_lists")
      .select("id, user_id")
      .eq("id", listId)
      .maybeSingle();
    if (!list) throw new ApiError(404, "清单不存在");
    if (list.user_id !== user.id) throw new ApiError(403, "无权访问该清单");

    const { data: rows } = await supabase
      .from("list_items")
      .select("id, order_index, document_id, candidate_metadata")
      .eq("reading_list_id", listId)
      .is("deleted_at", null)
      .order("order_index");
    const all = (rows ?? []) as Item[];

    // 已经有知识点的书跳过，避免重复消耗 token
    const targets = all.filter((it) => !it.candidate_metadata?.key_points?.length);
    if (targets.length === 0) return NextResponse.json({ updated: 0 });

    const docIds = Array.from(
      new Set(
        targets
          .map((it) => it.document_id)
          .filter((v): v is string => Boolean(v)),
      ),
    );

    const [{ data: docs }, { data: chapters }] = await Promise.all([
      docIds.length > 0
        ? supabase.from("documents").select("id, title, author").in("id", docIds)
        : Promise.resolve({ data: [] } as any),
      docIds.length > 0
        ? supabase
            .from("chapters")
            .select("document_id, title, order_index")
            .in("document_id", docIds)
            .order("order_index")
        : Promise.resolve({ data: [] } as any),
    ]);

    const docById = new Map<
      string,
      { id: string; title: string; author: string | null }
    >();
    for (const d of docs ?? []) {
      const doc = d as { id: string; title: string; author: string | null };
      docById.set(doc.id, doc);
    }
    const chapterTitles = new Map<string, string[]>();
    for (const c of chapters ?? []) {
      const t = (c as any)?.title?.trim();
      if (!t) continue;
      const arr = chapterTitles.get((c as any).document_id) ?? [];
      arr.push(t);
      chapterTitles.set((c as any).document_id, arr);
    }

    const books: BookPayload[] = [];
    const indexToItem: Item[] = [];
    for (const it of targets) {
      const doc = it.document_id ? docById.get(it.document_id) : null;
      const title = doc?.title ?? it.candidate_metadata?.title ?? "";
      if (!title) continue;
      indexToItem.push(it);
      books.push({
        i: indexToItem.length,
        title,
        author: doc?.author ?? "",
        chapters: (it.document_id
          ? chapterTitles.get(it.document_id) ?? []
          : []
        ).slice(0, 12),
      });
    }
    if (books.length === 0) return NextResponse.json({ updated: 0 });

    const result = await callDeepSeek(books, await getRequestLocale());

    let updated = 0;
    for (const row of result) {
      const it = indexToItem[row.i - 1];
      if (!it) continue;
      const { error } = await supabase
        .from("list_items")
        .update({
          candidate_metadata: {
            ...(it.candidate_metadata ?? {}),
            key_points: row.points,
          },
        })
        .eq("id", it.id);
      if (!error) updated += 1;
    }

    return NextResponse.json({ updated });
  } catch (e) {
    return errorResponse(e);
  }
}
