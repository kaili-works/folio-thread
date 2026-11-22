import { NextResponse } from "next/server";
import { ApiError, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getAiConfig } from "@/lib/config";
import { getRequestLocale } from "@/lib/request-locale";
import { marketPrompt, outputLanguageRule } from "@/lib/ai-locale";
import { errorResponse } from "@/lib/api-response";
import { tApi } from "@/lib/api-messages";

// 随机挑选一个领域，避免每次生成都落在同一类主题上
const DOMAINS = [
  "人文社科",
  "历史",
  "自然科学",
  "技术工程",
  "商业与管理",
  "心理学",
  "艺术与设计",
  "医学与健康",
  "教育",
  "城市与环境",
  "哲学",
  "传播与媒体",
  "经济与金融",
  "写作与表达",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// AI 随机生成一份「主题 + 书单」预览，用户可再点「使用此清单」保存为自己的主题
export async function POST() {
  try {
    const user = await requireUser();
    if (!rateLimit(`market-random:${user.id}`, 10, 60_000)) {
      return NextResponse.json(
        { error: tApi(await getRequestLocale(), "换一本过于频繁，请稍后再试") },
        { status: 429 },
      );
    }

    const { key: apiKey, url, model } = getAiConfig();
    if (!apiKey) throw new ApiError(500, "未配置 AI_API_KEY 或 DEEPSEEK_API_KEY");

    const domain = pick(DOMAINS);
    const locale = await getRequestLocale();

    const system =
      locale === "en"
        ? [
            "You design reading themes for a book-list market: one concrete, actionable research theme plus an ordered reading list.",
            "The theme must be specific with a clear angle, never a vague “introduction to X”.",
            "Output JSON only, no explanation.",
          ].join("\n")
        : [
            "你是阅读规划助手，负责为「书单市集」随机设计一个具体、可执行的研究主题，并给出循序书单。",
            "主题要具体、有抓手，不要写成泛泛的「XX入门」。",
            "只输出 JSON，不要任何解释。",
          ].join("\n");

    const userPrompt = [
      ...marketPrompt(locale, domain),
      outputLanguageRule(locale),
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
        temperature: 0.95,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new ApiError(502, `AI 生成失败：HTTP ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new ApiError(502, "AI 生成失败：返回为空");

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ApiError(502, "AI 生成失败：返回格式异常");
    }

    // 英文文案更长，截断上限按语言区分，避免把整句切在半截
    const limit =
      locale === "en"
        ? { name: 80, tagline: 140, description: 600 }
        : { name: 60, tagline: 60, description: 300 };

    const name = String(parsed?.name ?? "").trim().slice(0, limit.name);
    const tagline = String(parsed?.tagline ?? "").trim().slice(0, limit.tagline);
    const description = String(parsed?.description ?? "")
      .trim()
      .slice(0, limit.description);
    const books = (Array.isArray(parsed?.books) ? parsed.books : [])
      .map((b: any) => ({
        title: String(b?.title ?? "").trim(),
        author: String(b?.author ?? "").trim(),
        reason: String(b?.reason ?? "").trim(),
      }))
      .filter((b: { title: string }) => b.title)
      .slice(0, 7);

    if (!name || books.length === 0) {
      throw new ApiError(502, "AI 生成失败：主题或书目为空，请重试");
    }

    return NextResponse.json({
      template: {
        id: `random-${Date.now()}`,
        name,
        tagline,
        description,
        daily_budget_minutes: 30,
        books,
        generated: true,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
