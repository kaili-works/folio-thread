import { createAdminSupabase } from "./supabase/server";
import { findWeReadBook, getWeReadProgress } from "./weread";

const DEFAULT_READING_SPEED = 300; // 估算阅读速度：字/分钟

type PackItem = {
  list_item_id: string;
  theme_id: string;
  document_id: string;
  chapter_start: number;
  chapter_end: number;
  chapter_ids: string[];
  planned_minutes: number;
  reason: string;
  // 书库没有、但在微信读书可读的书：没有本地章节，只有跳转链接
  weread?: {
    bookId: string;
    readerLink: string;
    title: string;
    author: string;
    // 今日进度按「今日已读分钟 / 计划分钟」计算：
    // baseline_seconds 是排进今日包时的累计阅读时长，用来切出今天读了多久
    baseline_seconds?: number;
    reading_seconds?: number;
    book_progress?: number | null;
    today_minutes?: number;
    today_pct?: number;
    synced_at?: string;
  };
};

// 生成某用户某天的每日包草稿（覆盖当天已有草稿，但保留今日已完成的章节）
export async function generateDailyPack(
  userId: string,
  date: string,
  opts: { confirm?: boolean } = {},
) {
  const admin = createAdminSupabase();

  // 用户阅读速度、主题列表与今日已有包互不依赖，并行读取
  let readingSpeed = DEFAULT_READING_SPEED;
  const [{ data: profile }, { data: themes }, { data: existing }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("reading_speed")
        .eq("id", userId)
        .single(),
      admin.from("themes").select("*").eq("user_id", userId),
      admin
        .from("daily_packs")
        .select("items, status")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle(),
    ]);
  if (profile && typeof profile.reading_speed === "number") {
    readingSpeed = profile.reading_speed;
  }

  // 搁置的主题不排入今日包；有优先主题时只排优先主题，
  // 没有优先主题时才轮到普通主题
  const candidates = ((themes ?? []) as any[]).filter(
    (t) => t.status !== "shelved",
  );
  const priorityThemes = candidates.filter((t) => t.status === "priority");
  let orderedThemes = priorityThemes.length > 0 ? priorityThemes : candidates;

  // 各主题互不依赖，并行处理；单主题内部按依赖分波：
  // 最新清单 → 清单项 → [归属校验, 章节, 进度] 并行
  const buildThemeItem = async (theme: any): Promise<PackItem | null> => {
      // 取该主题最新一份清单（demo 不限 draft/active）
      const { data: lists } = await admin
        .from("reading_lists")
        .select("*")
        .eq("theme_id", theme.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const list = lists?.[0];
      if (!list) return null;

      // 该清单里未完成、未删除的项（按顺序），本地书和微信读书书一起排队
      const { data: items } = await admin
        .from("list_items")
        .select("*")
        .eq("reading_list_id", list.id)
        .in("status", ["unread", "in_progress"])
        .is("deleted_at", null)
        .order("order_index");

      // 按顺序找第一本「能读」的：本地书直接用；待补充的先查微信读书，
      // 查不到就跳过，继续看下一本，避免一本缺书卡住整个主题
      let item: any = null;
      let weread: any = null;
      let searches = 0;
      for (const candidate of (items ?? []) as any[]) {
        if (candidate.availability === "readable" && candidate.document_id) {
          item = candidate;
          break;
        }
        let link = candidate.candidate_metadata?.weread;
        if (!link?.readerLink && searches < 3) {
          searches += 1;
          const hit = await findWeReadBook(
            candidate.candidate_metadata?.title ?? "",
            candidate.candidate_metadata?.author ?? "",
          );
          if (hit) {
            link = { bookId: hit.bookId, readerLink: hit.readerLink };
            await admin
              .from("list_items")
              .update({
                candidate_metadata: {
                  ...(candidate.candidate_metadata ?? {}),
                  weread: link,
                },
              })
              .eq("id", candidate.id);
          }
        }
        if (link?.readerLink) {
          item = candidate;
          weread = link;
          break;
        }
      }
      if (!item) return null;

      // 轮到的是微信读书可读的书：不切章节，按当天预算给一段阅读时间
      if (item.availability !== "readable") {
        // 排进今日包时记下当前的累计阅读时长，作为「今天读了多久」的起点
        const snapshot = await getWeReadProgress(weread?.bookId ?? "");
        return {
          list_item_id: item.id,
          theme_id: theme.id,
          document_id: "",
          chapter_start: 0,
          chapter_end: 0,
          chapter_ids: [],
          planned_minutes: theme.daily_budget_minutes ?? 30,
          reason: item.reason ?? "",
          weread: {
            bookId: weread?.bookId ?? "",
            readerLink: weread.readerLink,
            title: item.candidate_metadata?.title ?? "",
            author: item.candidate_metadata?.author ?? "",
            baseline_seconds: snapshot?.readingSeconds ?? 0,
            reading_seconds: snapshot?.readingSeconds ?? 0,
            book_progress: snapshot?.bookProgress ?? null,
            today_minutes: 0,
            today_pct: 0,
          },
        };
      }

      const budgetWords = (theme.daily_budget_minutes ?? 30) * readingSpeed;

      // 私有书库归属校验、章节、进度三者互不依赖，并行查询
      const [{ data: ownedDoc }, { data: chapters }, { data: progress }] =
        await Promise.all([
          admin
            .from("documents")
            .select("id")
            .eq("id", item.document_id)
            .eq("owner_id", userId)
            .maybeSingle(),
          admin
            .from("chapters")
            .select("id, order_index, word_count_original")
            .eq("document_id", item.document_id)
            .order("order_index"),
          admin
            .from("reading_progress")
            .select("chapter_id, status")
            .eq("user_id", userId)
            .eq("document_id", item.document_id),
        ]);

      if (!ownedDoc) return null;

      const completed = new Set(
        (progress ?? [])
          .filter((p) => p.status === "completed")
          .map((p) => p.chapter_id),
      );

      // 从第一个未完成章节开始，按预算字数累加，超出截断
      let usedWords = 0;
      const selected: any[] = [];
      for (const ch of (chapters ?? []) as any[]) {
        if (completed.has(ch.id)) continue;
        const words = ch.word_count_original ?? 0;
        if (selected.length > 0 && usedWords + words > budgetWords) break;
        selected.push(ch);
        usedWords += words;
        if (usedWords >= budgetWords) break;
      }

      if (selected.length === 0) return null;

      return {
        list_item_id: item.id,
        theme_id: theme.id,
        document_id: item.document_id,
        chapter_start: selected[0].order_index,
        chapter_end: selected[selected.length - 1].order_index,
        chapter_ids: selected.map((c) => c.id),
        planned_minutes: theme.daily_budget_minutes ?? 30,
        reason: item.reason ?? "",
      };
  };

  let results = await Promise.all(orderedThemes.map(buildThemeItem));

  // 有优先主题、但当天一本都排不出来时，用普通主题兜底
  if (priorityThemes.length > 0 && results.every((r) => !r)) {
    const normal = candidates.filter((t) => t.status !== "priority");
    if (normal.length > 0) {
      orderedThemes = normal;
      results = await Promise.all(normal.map(buildThemeItem));
    }
  }

  const newItems = results.filter((x): x is PackItem => x !== null);

  // 保留今日包中已完成的章节：重新生成后进度条不从 0 开始
  const existingItems = ((existing?.items ?? []) as PackItem[]) ?? [];
  const existingChapterIds = [
    ...new Set(existingItems.flatMap((it) => it.chapter_ids ?? [])),
  ];
  const completedSet = new Set<string>();
  const chapterOrder = new Map<string, number>();
  if (existingChapterIds.length > 0) {
    const [{ data: prog }, { data: chs }] = await Promise.all([
      admin
        .from("reading_progress")
        .select("chapter_id, status")
        .eq("user_id", userId)
        .in("chapter_id", existingChapterIds),
      admin
        .from("chapters")
        .select("id, order_index")
        .in("id", existingChapterIds),
    ]);
    for (const p of prog ?? []) {
      if (p.status === "completed") completedSet.add(p.chapter_id);
    }
    for (const c of chs ?? []) {
      chapterOrder.set(c.id, c.order_index);
    }
  }

  const validThemeIds = new Set(orderedThemes.map((t) => t.id));
  const retained: PackItem[] = [];
  for (const it of existingItems) {
    // 已被搁置的主题，不再保留进今日包
    if (!validThemeIds.has(it.theme_id)) continue;
    const ids = (it.chapter_ids ?? []).filter((cid) => completedSet.has(cid));
    if (ids.length === 0) continue;
    ids.sort(
      (a, b) => (chapterOrder.get(a) ?? 0) - (chapterOrder.get(b) ?? 0),
    );
    retained.push({
      ...it,
      chapter_ids: ids,
      chapter_start: chapterOrder.get(ids[0]) ?? it.chapter_start,
      chapter_end: chapterOrder.get(ids[ids.length - 1]) ?? it.chapter_end,
    });
  }

  // 同一主题、同一本书的新旧章节合并为一项；不同书则保留两项
  const merged: PackItem[] = [...retained];
  for (const ni of newItems) {
    if (ni.weread) {
      // 同一条微信读书书目：沿用当天已记录的基线，重新生成不把今日进度清零
      const prev = existingItems.find(
        (it) => it.weread && it.list_item_id === ni.list_item_id,
      )?.weread;
      merged.push(
        prev && prev.baseline_seconds !== undefined
          ? {
              ...ni,
              weread: {
                ...ni.weread,
                baseline_seconds: prev.baseline_seconds,
                today_minutes: prev.today_minutes ?? 0,
                today_pct: prev.today_pct ?? 0,
              },
            }
          : ni,
      );
      continue;
    }
    const idx = merged.findIndex(
      (it) => it.theme_id === ni.theme_id && it.document_id === ni.document_id,
    );
    if (idx >= 0) {
      const cur = merged[idx];
      merged[idx] = {
        ...cur,
        chapter_ids: [...new Set([...cur.chapter_ids, ...ni.chapter_ids])],
        chapter_start: Math.min(cur.chapter_start, ni.chapter_start),
        chapter_end: Math.max(cur.chapter_end, ni.chapter_end),
        reason: ni.reason || cur.reason,
      };
    } else {
      merged.push(ni);
    }
  }

  // 保持主题的展示顺序（优先主题在前）
  const themeOrder = new Map(
    orderedThemes.map((t, i) => [t.id, i]),
  );
  merged.sort(
    (a, b) =>
      (themeOrder.get(a.theme_id) ?? 999) - (themeOrder.get(b.theme_id) ?? 999),
  );

  if (merged.length === 0) {
    return { empty: true, pack: null, items: [] };
  }

  const { data: pack, error } = await admin
    .from("daily_packs")
    .upsert(
      { user_id: userId, date, status: opts.confirm ? "confirmed" : "draft", items: merged },
      { onConflict: "user_id,date" },
    )
    .select()
    .single();

  if (error || !pack) {
    throw new Error(`写入每日包失败：${error?.message ?? "未知错误"}`);
  }

  return { empty: false, pack, items: merged };
}
