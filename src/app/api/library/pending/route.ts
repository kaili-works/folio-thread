import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

// 待补充清单：跨主题汇总书库里还没有的书（availability = pending_supplement）
export async function GET() {
  try {
    const user = await requireUser();
    const admin = createAdminSupabase();

    const { data: themes } = await admin
      .from("themes")
      .select("id, name, status")
      .eq("user_id", user.id);
    // 搁置的主题不再排入每日包，其待补充书籍也一并隐藏
    const activeThemes = (themes ?? []).filter((t) => t.status !== "shelved");
    const themeIds = activeThemes.map((t) => t.id);
    if (themeIds.length === 0) {
      return NextResponse.json({ pending: [] });
    }

    const { data: lists } = await admin
      .from("reading_lists")
      .select("id, theme_id")
      .in("theme_id", themeIds);
    const listIds = (lists ?? []).map((l) => l.id);
    if (listIds.length === 0) {
      return NextResponse.json({ pending: [] });
    }

    const { data: items } = await admin
      .from("list_items")
      .select("candidate_metadata, reason, reading_list_id")
      .in("reading_list_id", listIds)
      .eq("availability", "pending_supplement")
      .is("deleted_at", null);

    const themeNameByList = new Map(
      (lists ?? []).map((l) => [
        l.id,
        activeThemes.find((t) => t.id === l.theme_id)?.name ?? "",
      ]),
    );

    type PendingBook = {
      title: string;
      author: string;
      themes: string[];
      reason: string;
    };
    const grouped = new Map<string, PendingBook>();
    for (const it of (items ?? []) as {
      candidate_metadata: { title?: string; author?: string } | null;
      reason: string | null;
      reading_list_id: string;
    }[]) {
      const title = (it.candidate_metadata?.title ?? "").trim();
      if (!title) continue;
      const author = (it.candidate_metadata?.author ?? "").trim();
      const key = `${title}｜${author}`;
      let entry = grouped.get(key);
      if (!entry) {
        entry = { title, author, themes: [], reason: it.reason ?? "" };
        grouped.set(key, entry);
      }
      const themeName = themeNameByList.get(it.reading_list_id) ?? "";
      if (themeName && !entry.themes.includes(themeName)) {
        entry.themes.push(themeName);
      }
    }

    return NextResponse.json({ pending: [...grouped.values()] });
  } catch (e) {
    return errorResponse(e);
  }
}
