import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getAiConfig } from "@/lib/config";
import { getRequestLocale } from "@/lib/request-locale";
import { outputLanguageRule, reasonRules } from "@/lib/ai-locale";
import { errorResponse } from "@/lib/api-response";
import { tApi } from "@/lib/api-messages";

// 按当前界面语言重写某条清单项的推荐理由，书不变，只换文案
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    const locale = await getRequestLocale();
    if (!rateLimit(`item-reason:${user.id}`, 10, 60_000)) {
      return NextResponse.json(
        { error: tApi(locale, "重写理由过于频繁，请稍后再试") },
        { status: 429 },
      );
    }

    const body = await request.json();
    const itemId = body?.item_id as string | undefined;
    if (!itemId) throw new ApiError(400, "缺少清单项");

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

    let title = item.candidate_metadata?.title ?? "";
    let author = item.candidate_metadata?.author ?? "";
    if (item.document_id) {
      const { data: doc } = await supabase
        .from("documents")
        .select("title, author")
        .eq("id", item.document_id)
        .single();
      if (doc) {
        title = doc.title;
        author = doc.author ?? "";
      }
    }
    if (!title) throw new ApiError(400, "清单项缺少书名");

    const { key: apiKey, url, model } = getAiConfig();
    if (!apiKey) {
      throw new ApiError(503, "未配置 AI_API_KEY 或 DEEPSEEK_API_KEY（见 README 的 AI 配置）");
    }

    const system =
      "你是阅读规划助手。为清单里的一本书重写推荐理由。只输出 JSON，不要任何解释。";
    const userPrompt = [
      `研究主题：${theme.name}`,
      theme.description ? `主题描述：${theme.description}` : "",
      `书目：《${title}》${author ? `（${author}）` : ""}`,
      "按下面的要求重写这本书在清单里的推荐理由，不要更换书目。",
      '输出格式：{"reason":"推荐理由"}',
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
    if (!content) throw new Error("AI 生成失败：返回为空");

    const parsed = JSON.parse(content);
    const reason = String(parsed?.reason ?? "").trim();
    if (!reason) throw new Error("AI 生成失败：返回为空");

    const { error } = await supabase
      .from("list_items")
      .update({ reason, lang: locale })
      .eq("id", itemId)
      .eq("reading_list_id", list.id);
    if (error) throw new ApiError(500, `更新理由失败：${error.message}`);

    return NextResponse.json({ ok: true, reason, lang: locale });
  } catch (e) {
    return errorResponse(e);
  }
}
