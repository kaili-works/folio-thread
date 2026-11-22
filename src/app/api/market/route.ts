import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import {
  MARKET_TEMPLATES,
  localizeMarketTemplate,
  marketTemplatesFor,
} from "@/lib/market";
import { getRequestLocale } from "@/lib/request-locale";
import { errorResponse } from "@/lib/api-response";

// 列出书单市集模板（按界面语言返回）
export async function GET() {
  try {
    await requireUser();
    const locale = await getRequestLocale();
    return NextResponse.json({ templates: marketTemplatesFor(locale) });
  } catch (e) {
    return errorResponse(e);
  }
}

// 克隆某个模板：创建同名主题 + 草稿清单（库外候选，待刷新匹配）
// 也接受 AI 随机生成的 template（此时没有 template_id）
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const locale = await getRequestLocale();
    const body = await request.json();
    const templateId = body?.template_id as string | undefined;
    const generated = body?.template as
      | {
          name?: string;
          description?: string;
          books?: { title?: string; author?: string; reason?: string }[];
        }
      | undefined;

    let tpl: {
      name: string;
      description: string;
      daily_budget_minutes: number;
      books: { title: string; author: string; reason: string }[];
    };

    if (templateId) {
      const found = MARKET_TEMPLATES.find((t) => t.id === templateId);
      if (!found) throw new ApiError(404, "模板不存在");
      tpl = localizeMarketTemplate(found, locale);
    } else if (generated) {
      const name = String(generated.name ?? "").trim();
      if (!name) throw new ApiError(400, "生成的清单缺少主题名称");
      const books = (Array.isArray(generated.books) ? generated.books : [])
        .map((b) => ({
          title: String(b?.title ?? "").trim(),
          author: String(b?.author ?? "").trim(),
          reason: String(b?.reason ?? "").trim(),
        }))
        .filter((b) => b.title)
        .slice(0, 10);
      if (books.length === 0) throw new ApiError(400, "生成的清单没有书目");
      tpl = {
        name: name.slice(0, 60),
        description: String(generated.description ?? "").trim().slice(0, 500),
        daily_budget_minutes: 30,
        books,
      };
    } else {
      throw new ApiError(400, "缺少模板");
    }

    const admin = createAdminSupabase();

    const { data: theme, error: themeErr } = await admin
      .from("themes")
      .insert({
        user_id: user.id,
        name: tpl.name,
        description: tpl.description,
        daily_budget_minutes: tpl.daily_budget_minutes,
        daily_budget_weight: 1.0,
      })
      .select()
      .single();
    if (themeErr || !theme) {
      throw new ApiError(500, `创建主题失败：${themeErr?.message ?? "未知错误"}`);
    }

    const { data: list, error: listErr } = await admin
      .from("reading_lists")
      .insert({ user_id: user.id, theme_id: theme.id, status: "draft" })
      .select()
      .single();
    if (listErr || !list) {
      throw new ApiError(500, `创建清单失败：${listErr?.message ?? "未知错误"}`);
    }

    const rows = tpl.books.map((b, i) => ({
      reading_list_id: list.id,
      order_index: i + 1,
      reason: b.reason,
      lang: locale,
      estimated_minutes: 30,
      source: "ai_web",
      status: "unread",
      document_id: null,
      availability: "pending_supplement",
      candidate_metadata: { title: b.title, author: b.author },
    }));
    const { error: itemErr } = await admin.from("list_items").insert(rows);
    if (itemErr) {
      throw new ApiError(500, `写入清单项失败：${itemErr.message}`);
    }

    return NextResponse.json({ theme, list });
  } catch (e) {
    return errorResponse(e);
  }
}
