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

type Book = { id: string; title: string; author: string | null };
type Recommendation = { title: string; author: string; reason: string };

async function recommendOne(params: {
  themeName: string;
  description: string;
  position: number;
  total: number;
  before: string[];
  after: string[];
  exclude: string[];
  locale: Locale;
}): Promise<Recommendation> {
  const { key: apiKey, url, model } = getAiConfig();
  if (!apiKey) throw new Error("未配置 AI_API_KEY 或 DEEPSEEK_API_KEY");

  const { themeName, description, position, total, before, after, exclude, locale } =
    params;

  const system =
    "你是阅读规划助手。根据研究主题和书目序列中的位置，为清单里的某一本推荐替代书。只输出 JSON，不要任何解释。";

  const userPrompt = [
    `研究主题：${themeName}`,
    description ? `主题描述：${description}` : "",
    `这份清单按由浅入深排列，共 ${total} 本，现在要替换第 ${position} 本。`,
    before.length ? `排在它前面的是：${before.join("、")}` : "它是清单的第一本。",
    after.length ? `排在它后面的是：${after.join("、")}` : "它是清单的最后一本。",
    "请推荐 1 本替代书：难度要与这个位置匹配，与前后书目自然衔接。",
    exclude.length ? `以下书目已在清单里，不要重复推荐：${exclude.join("、")}` : "",
    '输出格式：{"book":{"title":"书名","author":"作者","reason":"推荐理由"}}',
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
      temperature: 0.6,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`AI 请求失败：HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回为空");

  const parsed = JSON.parse(content);
  const raw = parsed?.book ?? (Array.isArray(parsed?.books) ? parsed.books[0] : null);
  const rec: Recommendation = {
    title: String(raw?.title ?? "").trim(),
    author: String(raw?.author ?? "").trim(),
    reason: String(raw?.reason ?? "").trim(),
  };
  if (!rec.title) throw new Error("没有拿到推荐结果");
  return rec;
}

// 换一本：为清单里的某一项重新推荐一本书，原位替换，顺序不变
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    if (!rateLimit(`replace-item:${user.id}`, 10, 60_000)) {
      return NextResponse.json(
        { error: tApi(await getRequestLocale(), "操作过于频繁，请稍后再试") },
        { status: 429 },
      );
    }
    const body = await request.json();
    const itemId = body?.item_id as string | undefined;
    if (!itemId) throw new ApiError(400, "缺少清单项");

    const locale = await getRequestLocale();

    const { data: item } = await supabase
      .from("list_items")
      .select("*")
      .eq("id", itemId)
      .single();
    if (!item) throw new ApiError(404, "清单项不存在");

    const { data: list } = await supabase
      .from("reading_lists")
      .select("*")
      .eq("id", item.reading_list_id)
      .single();
    if (!list) throw new ApiError(404, "清单不存在");

    const { data: theme } = await supabase
      .from("themes")
      .select("*")
      .eq("id", list.theme_id)
      .single();
    if (!theme) throw new ApiError(404, "主题不存在");

    const { data: siblings } = await supabase
      .from("list_items")
      .select("*")
      .eq("reading_list_id", list.id)
      .is("deleted_at", null)
      .order("order_index");
    const all = (siblings ?? []) as any[];

    const docIds = all.map((it) => it.document_id).filter(Boolean) as string[];
    const { data: docs } = docIds.length
      ? await supabase.from("documents").select("id, title").in("id", docIds)
      : { data: [] };
    const titleById = new Map((docs ?? []).map((d: any) => [d.id, d.title]));
    const titleOf = (it: any) =>
      it.document_id
        ? titleById.get(it.document_id)
        : it.candidate_metadata?.title;

    const idx = all.findIndex((it) => it.id === itemId);
    const titles = all.map(titleOf).filter(Boolean) as string[];

    const { data: booksData } = await supabase
      .from("documents")
      .select("id, title, author")
      .order("created_at", { ascending: true });
    const books = (booksData ?? []) as Book[];

    const rec = await recommendOne({
      themeName: theme.name,
      description: theme.description ?? "",
      position: idx + 1,
      total: all.length,
      before: titles.slice(Math.max(0, idx - 2), idx),
      after: titles.slice(idx + 1, idx + 3),
      exclude: titles,
      locale,
    });

    // 书库里有就直接接上，没有就查微信读书，再没有就记为待补充
    const matched = books.find(
      (b) =>
        b.title === rec.title ||
        b.title.includes(rec.title) ||
        rec.title.includes(b.title),
    );
    const weread = matched
      ? null
      : await findWeReadBook(rec.title, rec.author);

    const { error } = await supabase
      .from("list_items")
      .update({
        reason: rec.reason || item.reason,
        lang: locale,
        source: matched ? "library" : "ai_web",
        status: "unread",
        locked: false,
        document_id: matched ? matched.id : null,
        availability: matched ? "readable" : "pending_supplement",
        candidate_metadata: matched
          ? null
          : {
              title: rec.title,
              author: rec.author,
              ...(weread
                ? {
                    weread: {
                      bookId: weread.bookId,
                      readerLink: weread.readerLink,
                    },
                  }
                : {}),
            },
      })
      .eq("id", itemId)
      .eq("reading_list_id", list.id);
    if (error) throw new ApiError(500, `换书失败：${error.message}`);

    return NextResponse.json({ ok: true, title: rec.title });
  } catch (e) {
    return errorResponse(e);
  }
}
