import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getDeepSeekKey, getDeepSeekUrl } from "@/lib/config";
import {
  DOMAIN_KEYS,
  DOMAIN_LABELS,
  normalizeDomain,
  type DomainKey,
} from "@/lib/domains";
import { errorResponse } from "@/lib/api-response";
import { tApi } from "@/lib/api-messages";
import { getRequestLocale } from "@/lib/request-locale";

const DEEPSEEK_URL = getDeepSeekUrl();
const MODEL = "deepseek-flash";

type Pending = {
  i: number;
  name: string;
  description: string;
  books: string[];
};

// 让 AI 把主题归到 10 个领域之一
async function callDeepSeek(themes: Pending[]) {
  const apiKey = await getDeepSeekKey();
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY");

  const system = [
    "你是图书管理员。把用户的阅读主题归入给定的领域标签。",
    `领域标签只有这些：${DOMAIN_KEYS.map((k) => DOMAIN_LABELS[k].zh).join("、")}。`,
    "必须从中选一个，不要发明新标签；拿不准时选「其他」。",
    "只输出 JSON，不要任何解释。",
  ].join("\n");

  const userPrompt = [
    "待归类的阅读主题（books 是清单里的书目，可作参考）：",
    JSON.stringify(themes),
    '输出格式：{"themes":[{"i":1,"domain":"心理与成长"}]}',
  ].join("\n");

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
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek 请求失败：HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 返回为空");

  const parsed = JSON.parse(content);
  const rows = Array.isArray(parsed) ? parsed : parsed?.themes;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((r: any) => ({
      i: Number(r?.i),
      domain: normalizeDomain(r?.domain),
    }))
    .filter((r): r is { i: number; domain: DomainKey } =>
      Number.isFinite(r.i) && r.domain !== null,
    );
}

export async function POST() {
  const supabase = await createServerSupabase();
  try {
    const user = await requireUser();
    if (!rateLimit(`classify:${user.id}`, 3, 60_000)) {
      return NextResponse.json(
        { error: tApi(await getRequestLocale(), "分类请求过于频繁，请稍后再试") },
        { status: 429 },
      );
    }

    // 探测 domain 列是否已迁移；没有就返回标记，前端提示去执行 0008
    const probe = await supabase.from("themes").select("id, domain").limit(1);
    if (probe.error) {
      return NextResponse.json({ domain_ready: false, updated: 0 });
    }

    const { data: themes } = await supabase
      .from("themes")
      .select("id, name, description, domain")
      .eq("user_id", user.id)
      .order("created_at");

    const pending = (themes ?? []).filter((t) => !normalizeDomain(t.domain));
    if (pending.length === 0) {
      return NextResponse.json({ domain_ready: true, updated: 0 });
    }

    // 取每个主题的前几本书名，帮助判断领域
    const { data: lists } = await supabase
      .from("reading_lists")
      .select("id, theme_id")
      .eq("user_id", user.id);
    const listTheme = new Map<string, string>();
    for (const l of lists ?? []) listTheme.set(l.id, l.theme_id);

    const listIds = [...listTheme.keys()];
    const { data: items } = listIds.length
      ? await supabase
          .from("list_items")
          .select("reading_list_id, document_id, candidate_metadata")
          .in("reading_list_id", listIds)
          .is("deleted_at", null)
          .order("order_index")
      : { data: [] };

    const docIds = [
      ...new Set(
        (items ?? [])
          .map((it) => it.document_id)
          .filter((v): v is string => Boolean(v)),
      ),
    ];
    const { data: docs } = docIds.length
      ? await supabase.from("documents").select("id, title").in("id", docIds)
      : { data: [] };
    const docTitle = new Map((docs ?? []).map((d) => [d.id, d.title]));

    const booksByTheme = new Map<string, string[]>();
    for (const it of items ?? []) {
      const themeId = listTheme.get(it.reading_list_id);
      if (!themeId) continue;
      const title = it.document_id
        ? docTitle.get(it.document_id)
        : it.candidate_metadata?.title;
      if (!title) continue;
      const arr = booksByTheme.get(themeId) ?? [];
      if (arr.length < 6) arr.push(title);
      booksByTheme.set(themeId, arr);
    }

    const payload: Pending[] = pending.map((t, idx) => ({
      i: idx + 1,
      name: t.name,
      description: (t.description ?? "").slice(0, 120),
      books: booksByTheme.get(t.id) ?? [],
    }));

    const result = await callDeepSeek(payload);

    let updated = 0;
    for (const row of result) {
      const t = pending[row.i - 1];
      if (!t) continue;
      const { error } = await supabase
        .from("themes")
        .update({ domain: row.domain })
        .eq("id", t.id)
        .eq("user_id", user.id);
      if (!error) updated += 1;
    }

    return NextResponse.json({ domain_ready: true, updated });
  } catch (e) {
    return errorResponse(e);
  }
}
