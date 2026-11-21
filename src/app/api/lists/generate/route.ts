import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getDeepSeekKey, getDeepSeekUrl } from "@/lib/config";
import { findWeReadBook } from "@/lib/weread";

const DEEPSEEK_URL = getDeepSeekUrl();
const MODEL = "deepseek-flash";

type Book = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  total_words_original: number | null;
};

// AI 推荐的书目（无论库内有没有）
type Recommendation = {
  title: string;
  author: string;
  reason: string;
};

// 调用 DeepSeek 推荐该主题的书目（不限于库内）
async function callDeepSeek(
  themeName: string,
  description: string,
): Promise<Recommendation[]> {
  const apiKey = await getDeepSeekKey();
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY");

  const system = [
    "你是阅读规划助手。根据用户的研究主题，推荐一个循序渐进的阅读书目。",
    "排序偏好：综述/导论/背景类优先；短篇/易读可前置建立信心；概念上靠前的先于依赖它的材料。",
    "只输出 JSON，不要任何解释。",
  ].join("\n");

  const userPrompt = [
    `研究主题：${themeName}`,
    description ? `主题描述/背景：${description}` : "",
    "请推荐这个主题下适合循序阅读的经典/入门书籍，5-6 本。",
    '输出格式：{"books":[{"title":"书名","author":"作者","reason":"推荐理由"}]}',
    "reason 要求 60-90 字中文，按三部分来写：",
    "1) 角色：这本书在阅读序列里的位置，为什么此时读、与前后项的关系；",
    "2) 作者：一句话介绍作者身份、代表作或在该领域的权威性；",
    "3) 地位：获奖、长期畅销、领域经典或标准教材等，只写有把握的事实，不确定就不写，禁止编造。",
    "禁止「很重要」「值得一读」这类空话。",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek 请求失败：HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 返回为空");

  const parsed = JSON.parse(content);
  const books = Array.isArray(parsed) ? parsed : parsed?.books;
  return Array.isArray(books)
    ? books
        .map((b) => ({
          title: (b?.title ?? "").trim(),
          author: (b?.author ?? "").trim(),
          reason: (b?.reason ?? "").trim(),
        }))
        .filter((b) => b.title && b.reason)
    : [];
}

// 匹配库内书籍：返回 { recommendation, book? }
function matchBooks(recs: Recommendation[], books: Book[]) {
  return recs.map((r) => {
    const book = books.find(
      (b) =>
        b.title === r.title || b.title.includes(r.title) || r.title.includes(b.title),
    );
    return { recommendation: r, book };
  });
}

// 规则兜底：库内短篇优先，全部可读
function fallback(books: Book[]) {
  const sorted = [...books].sort(
    (a, b) => (a.total_words_original ?? 0) - (b.total_words_original ?? 0),
  );
  return sorted.slice(0, 10).map((b) => ({
    recommendation: { title: b.title, author: b.author ?? "", reason: "自动推荐：篇幅较短，适合先行阅读" },
    book: b,
  }));
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    if (!rateLimit(`generate:${user.id}`, 3, 60_000)) {
      return NextResponse.json(
        { error: "生成书单过于频繁，请稍后再试" },
        { status: 429 },
      );
    }
    const body = await request.json();
    const themeId = body?.theme_id as string | undefined;
    if (!themeId) throw new ApiError(400, "缺少主题");

    const { data: theme } = await supabase
      .from("themes")
      .select("*")
      .eq("id", themeId)
      .single();
    if (!theme) throw new ApiError(404, "主题不存在");

    const { data: booksData } = await supabase
      .from("documents")
      .select("id, title, author, description, total_words_original")
      .order("created_at", { ascending: true });
    const books = (booksData ?? []) as Book[];

    // 调 AI 推荐（失败重试 1 次，再失败走兜底）
    let matched: { recommendation: Recommendation; book?: Book }[] = [];
    let source = "ai";
    for (let attempt = 0; attempt < 2 && matched.length === 0; attempt++) {
      try {
        const recs = await callDeepSeek(theme.name, theme.description ?? "");
        if (recs.length > 0) matched = matchBooks(recs, books);
      } catch {
        matched = [];
      }
    }

    if (matched.length === 0) {
      matched = fallback(books);
      source = "rule_fallback";
    }

    // 首次生成本人清单，控制在 5–6 项（清单短一点，更容易读完）
    matched = matched.slice(0, 6);

    // 库内没有的书顺手查一次微信读书，命中就带上阅读链接（未配置 key 时全为 null）
    const wereadHits = await Promise.all(
      matched.map((m) =>
        m.book
          ? Promise.resolve(null)
          : findWeReadBook(m.recommendation.title, m.recommendation.author),
      ),
    );

    // 写 reading_list（draft）
    const { data: list, error: listErr } = await supabase
      .from("reading_lists")
      .insert({ user_id: user.id, theme_id: themeId, status: "draft" })
      .select()
      .single();
    if (listErr || !list) {
      throw new ApiError(500, `创建清单失败：${listErr?.message ?? "未知错误"}`);
    }

    // 写 list_items：库内匹配上的 readable，没匹配上的 pending_supplement
    const rows = matched.map((m, i) => {
      const base = {
        reading_list_id: list.id,
        order_index: i + 1,
        reason: m.recommendation.reason,
        estimated_minutes: 30,
        source: m.book ? "library" : "ai_web",
        status: "unread",
      };
      if (m.book) {
        return {
          ...base,
          document_id: m.book.id,
          availability: "readable",
        };
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

    const { error: itemErr } = await supabase.from("list_items").insert(rows);
    if (itemErr) throw new ApiError(500, `写入清单项失败：${itemErr.message}`);

    const { data: savedItems } = await supabase
      .from("list_items")
      .select(
        "id, order_index, reason, availability, status, locked, document_id, candidate_metadata",
      )
      .eq("reading_list_id", list.id)
      .is("deleted_at", null)
      .order("order_index");

    // list_items 有 document_id / matched_document_id 两个外键指向 documents，
    // 直接 embed documents(...) 会因关系歧义报错，这里手动拼书名/作者。
    const bookById = new Map((books ?? []).map((b) => [b.id, b]));
    const items = (savedItems ?? []).map((it: any) => {
      const b = it.document_id ? bookById.get(it.document_id) : null;
      return {
        ...it,
        documents: b ? { title: b.title, author: b.author } : null,
      };
    });

    return NextResponse.json({
      list,
      items,
      source,
      // 库内可读材料不足时明确提示，而不是堆满待补充项
      hint:
        books.length < 3
          ? `你的书库只有 ${books.length} 本可读材料，清单中的待补充项需要你自行上传 EPUB 后才能阅读`
          : null,
      theme: { name: theme.name, description: theme.description },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
