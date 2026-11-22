"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cacheChapter } from "@/lib/offline";
import { Icon } from "@/components/Icon";
import { useI18n, useT } from "@/i18n";

type PackItem = {
  list_item_id: string;
  theme_id: string;
  document_id: string;
  chapter_start: number;
  chapter_end: number;
  chapter_ids: string[];
  planned_minutes: number;
  reason: string;
  weread?: {
    bookId: string;
    readerLink: string;
    title: string;
    author: string;
    baseline_seconds?: number;
    reading_seconds?: number;
    book_progress?: number | null;
    today_minutes?: number;
    today_pct?: number;
    synced_at?: string;
  };
};

type Pack = {
  id: string;
  date: string;
  status: string;
  items: PackItem[];
};

type Progress = {
  done: number;
  total: number;
  chapterDone: number;
  chapterTotal: number;
};

type PackCache = {
  pack: Pack;
  names: Record<string, string>;
  progress: Progress | null;
};

// 提示只存类型与参数，切换语言后按当前语言重新渲染
type LoadError =
  | { kind: "offline" }
  | { kind: "failed" }
  | { kind: "cached"; date: string };

type Message =
  | { kind: "generated" }
  | { kind: "generateEmpty" }
  | { kind: "generateFailed"; error: string | number }
  | { kind: "loadFailed" };

const PACK_CACHE_PREFIX = "dr_pack_cache_";

// 后端暂时不可用时，用最近一次成功读取的今日包兜底
function readPackCache(uid: string | null): PackCache | null {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(PACK_CACHE_PREFIX + uid);
    if (!raw) return null;
    const data = JSON.parse(raw) as PackCache;
    return data?.pack ? data : null;
  } catch {
    return null;
  }
}

function writePackCache(uid: string | null, data: PackCache) {
  if (!uid) return;
  try {
    localStorage.setItem(PACK_CACHE_PREFIX + uid, JSON.stringify(data));
  } catch {
    // 存储已满或被禁用时忽略，不影响正常使用
  }
}

export default function DailyPackCard({
  onSettings,
}: {
  onSettings?: () => void;
}) {
  const supabase = createClient();
  const t = useT();
  const { locale } = useI18n();

  const [pack, setPack] = useState<Pack | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // 首次拉取完成前不渲染空状态，避免「今天还没有可排的阅读包」闪一下
  const [loading, setLoading] = useState(true);
  // 离线或接口失败时的明确提示，避免一直停在「正在读取今日包…」
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  // 没有今日包时，先判断卡在哪一步，空状态直接给出下一步的按钮
  const [setup, setSetup] = useState<{
    themes: number;
    readable: number;
  } | null>(null);

  async function loadProgress(p: Pack, uid: string | null) {
    if (!uid) return null;
    const chapterIds = [
      ...new Set(p.items.flatMap((it) => it.chapter_ids ?? [])),
    ];

    let chapterDone = 0;
    if (chapterIds.length > 0) {
      const { data } = await supabase
        .from("reading_progress")
        .select("chapter_id, status")
        .eq("user_id", uid)
        .in("chapter_id", chapterIds);
      const doneSet = new Set(
        (data ?? [])
          .filter((r) => r.status === "completed")
          .map((r) => r.chapter_id),
      );
      chapterDone = chapterIds.filter((id) => doneSet.has(id)).length;
    }

    // 微信读书的书没有章节：按「今日已读分钟 / 计划分钟」折算成 1 个单位的进度
    const wereadItems = p.items.filter((it) => it.weread);
    const wereadDone = wereadItems.reduce(
      (sum, it) =>
        sum + Math.min(100, Math.max(0, it.weread?.today_pct ?? 0)) / 100,
      0,
    );

    const next: Progress = {
      done: chapterDone + wereadDone,
      total: chapterIds.length + wereadItems.length,
      chapterDone,
      chapterTotal: chapterIds.length,
    };
    setProgress(next);
    // 同步更新缓存里的进度，离线时显示的百分比不会停在旧值
    const cached = readPackCache(uid);
    if (cached && cached.pack.date === p.date) {
      writePackCache(uid, { ...cached, progress: next });
    }
    return next;
  }

  function previewTodayMinutes(item: PackItem, minutes: number) {
    if (!pack) return;
    const planned = Math.max(1, item.planned_minutes);
    const todayPct = Math.min(100, Math.round((minutes / planned) * 100));
    const next: Pack = {
      ...pack,
      items: pack.items.map((it) =>
        it.list_item_id === item.list_item_id
          ? {
              ...it,
              weread: { ...it.weread!, today_minutes: minutes, today_pct: todayPct },
            }
          : it,
      ),
    };
    setPack(next);
    loadProgress(next, userId);
  }

  async function saveTodayMinutes(item: PackItem, minutes: number) {
    await fetch("/api/daily-pack/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        list_item_id: item.list_item_id,
        minutes,
      }),
    }).catch(() => null);
  }

  // 进页面时顺便让服务端按微信读书的最新阅读时长重算今日进度
  async function syncWeread() {
    const res = await fetch("/api/weread/sync", { method: "POST" }).catch(
      () => null,
    );
    if (!res?.ok) return false;
    const json = await res.json().catch(() => null);
    return Boolean(json?.pack_updated);
  }

  async function cachePack(p: Pack) {
    const uid =
      userId ?? (await supabase.auth.getSession()).data.session?.user?.id;
    if (!uid) return;
    for (const it of p.items) {
      for (const chapterId of it.chapter_ids) {
        const { data: chapter } = await supabase
          .from("chapters")
          .select("*")
          .eq("id", chapterId)
          .single();
        const { data: paragraphs } = await supabase
          .from("paragraphs")
          .select("*")
          .eq("chapter_id", chapterId)
          .order("order_index");
        if (chapter && paragraphs) {
          await cacheChapter(uid, chapterId, chapter, paragraphs);
        }
      }
    }
  }

  // 请求失败时回退到本地缓存，避免离线只能看到一句错误
  function restoreCachedPack(uid: string | null) {
    const cached = readPackCache(uid);
    if (!cached) return false;
    setPack(cached.pack);
    setNames(cached.names ?? {});
    setProgress(cached.progress ?? null);
    setSetup(null);
    setLoadError({ kind: "cached", date: cached.pack.date });
    setLoading(false);
    return true;
  }

  async function loadPack(withWereadSync = true) {
    setLoadError(null);
    const uid =
      (await supabase.auth.getSession()).data.session?.user?.id ?? null;
    setUserId(uid);
    let res: Response;
    try {
      res = await fetch("/api/daily-pack");
    } catch {
      if (restoreCachedPack(uid)) return;
      const offlineNow =
        typeof navigator !== "undefined" && !navigator.onLine;
      setLoadError({ kind: offlineNow ? "offline" : "failed" });
      setLoading(false);
      return;
    }
    if (!res.ok) {
      if (restoreCachedPack(uid)) return;
      setLoadError({ kind: "failed" });
      setLoading(false);
      return;
    }
    const json = await res.json().catch(() => ({}));
    const p = json.pack as Pack | null;
    setPack(p);

    if (!p && uid) {
      // 服务端确认今天没有包时清掉旧缓存，避免明天还看到过期内容
      try {
        localStorage.removeItem(PACK_CACHE_PREFIX + uid);
      } catch {
        // 忽略
      }
    }

    if (!p) {
      // 还没有包：看用户是没建主题，还是清单里的书还没进书库
      const sres = await fetch("/api/stats").catch(() => null);
      const sjson = sres ? await sres.json().catch(() => ({})) : {};
      const themes = (sjson.themes ?? []) as {
        items?: { availability?: string; weread?: boolean }[];
      }[];
      setSetup({
        themes: themes.length,
        readable: themes.reduce(
          (n, t) =>
            n +
            (t.items ?? []).filter(
              (i) => i.availability === "readable" || i.weread,
            ).length,
          0,
        ),
      });
    } else {
      setSetup(null);
    }

    // 有微信读书条目时，先让服务端按最新阅读时长重算今日进度，有变化再取一次
    if (withWereadSync && p?.items?.some((it) => it.weread)) {
      if (await syncWeread()) {
        await loadPack(false);
        return;
      }
    }

    if (p?.items?.length) {
      const docIds = [
        ...new Set(p.items.map((i) => i.document_id).filter(Boolean)),
      ];
      const themeIds = [...new Set(p.items.map((i) => i.theme_id))];
      const [{ data: docs }, { data: themes }] = await Promise.all([
        supabase.from("documents").select("id, title").in("id", docIds),
        supabase.from("themes").select("id, name").in("id", themeIds),
      ]);
      const map: Record<string, string> = {};
      for (const d of docs ?? []) map[d.id] = d.title;
      for (const t of themes ?? []) map[t.id] = t.name;
      setNames(map);
      // 先落缓存，后面的章节离线缓存即使耗时也不影响今日包兜底
      writePackCache(uid, { pack: p, names: map, progress: null });

      if (p.status === "confirmed") await cachePack(p);

      // 计算今日包的章节完成进度（从阅读器返回后也会刷新）
      await loadProgress(p, uid);
    } else {
      setProgress(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每天 24 点自动换成新一天的阅读包
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function scheduleNextMidnight() {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 5, 0);
      timer = setTimeout(
        async () => {
          await loadPack();
          scheduleNextMidnight();
        },
        next.getTime() - now.getTime(),
      );
    }
    scheduleNextMidnight();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从阅读器返回、或隔夜回到页面时刷新
  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== "visible") return;
      // 跨过零点：日期变了就重新取新一天的包
      if (pack) {
        const d = new Date();
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (pack.date !== local) {
          loadPack();
          return;
        }
      }
      if (pack && pack.items.length > 0) {
        loadProgress(pack, userId);
      }
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);

  // 断网恢复后自动重试；缓存兜底时也借这次机会换成最新数据
  useEffect(() => {
    function retry() {
      if (!loadError && pack) return;
      setLoading(!pack);
      loadPack();
    }
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, loadError]);

  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;
  const packDone =
    !!progress && progress.total > 0 && progress.done >= progress.total - 0.001;

  async function generate() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/daily-pack", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ kind: json.empty ? "generateEmpty" : "generated" });
        loadPack();
      } else {
        setMessage({
          kind: "generateFailed",
          error: json.error ?? res.status,
        });
      }
    } catch {
      setMessage({ kind: "loadFailed" });
    }
    setBusy(false);
  }

  const now = new Date();
  const dateLabel =
    locale === "en"
      ? new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
          .format(now)
          .replace(",", " ·")
      : `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} · 星期${"日一二三四五六"[now.getDay()]}`;
  const totalMinutes =
    pack?.items.reduce((sum, it) => sum + (it.planned_minutes ?? 0), 0) ?? 0;
  const chapterCount =
    pack?.items.reduce(
      (sum, it) => sum + (it.weread ? 0 : it.chapter_ids.length),
      0,
    ) ?? 0;
  const hasWeread = pack?.items.some((it) => it.weread) ?? false;
  const metaText =
    pack && pack.items.length > 0
      ? hasWeread || chapterCount === 0
        ? t.today.metaItems(pack.items.length, totalMinutes)
        : t.today.metaChapters(chapterCount, totalMinutes)
      : null;

  const loadErrorText =
    loadError?.kind === "offline"
      ? t.today.offline
      : loadError?.kind === "cached"
        ? t.today.cachedHint(loadError.date)
        : loadError
          ? t.today.loadFailed
          : "";

  const messageText =
    message?.kind === "generated"
      ? t.today.generated
      : message?.kind === "generateEmpty"
        ? t.today.generateEmpty
        : message?.kind === "generateFailed"
          ? t.today.generateFailed(message.error)
          : message?.kind === "loadFailed"
            ? t.today.loadFailed
            : "";

  const emptyText =
    setup === null
      ? t.today.empty
      : setup.themes === 0
        ? t.today.emptyNoTheme
        : setup.readable === 0
          ? t.today.emptyNoBooks
          : t.today.empty;

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <span className="kicker">{dateLabel}</span>
          <h1>{t.today.title}</h1>
        </div>
        <div className="page-head-actions">
          {metaText && <span className="page-meta">{metaText}</span>}
          {pack && (
            <>
              <button
                className={`icon-btn${busy ? " spin" : ""}`}
                onClick={generate}
                disabled={busy}
                title={t.today.regenerate}
                aria-label={t.today.regenerate}
              >
                <Icon name="refresh" />
              </button>
              {onSettings && (
                <button
                  className="icon-btn"
                  onClick={onSettings}
                  title={t.today.settings}
                  aria-label={t.today.settings}
                >
                  <Icon name="gear" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {pack && loadErrorText && (
        <p className="muted" style={{ margin: "0 0 16px" }}>
          {loadErrorText}
          <button
            className="link-btn"
            style={{ marginLeft: 8 }}
            onClick={() => loadPack()}
          >
            {t.today.retry}
          </button>
        </p>
      )}

      {!pack && loading ? (
        <p className="muted">{t.today.loading}</p>
      ) : !pack && loadErrorText ? (
        <div className="pack-empty">
          <p className="sub" style={{ margin: "0 0 12px" }}>
            {loadErrorText}
          </p>
          <button
            className="btn-sm"
            onClick={() => {
              setLoading(true);
              loadPack();
            }}
          >
            {t.today.retry}
          </button>
        </div>
      ) : !pack ? (
        <div className="pack-empty">
          <p className="sub" style={{ margin: "0 0 12px" }}>
            {emptyText}
          </p>
          <div className="pack-empty-acts">
            {setup === null ? (
              <>
                <Link href="/themes" className="btn-sm btn-ghost">
                  {t.today.goThemes}
                </Link>
                <Link href="/library" className="btn-sm btn-ghost">
                  {t.today.goLibrary}
                </Link>
                <button onClick={generate} disabled={busy}>
                  {busy ? t.today.generating : t.today.generate}
                </button>
              </>
            ) : setup.themes === 0 ? (
              <Link href="/themes" className="btn-sm">
                {t.today.createTheme}
              </Link>
            ) : setup.readable === 0 ? (
              <>
                <Link href="/library" className="btn-sm">
                  {t.today.uploadBook}
                </Link>
                <Link href="/themes" className="btn-sm btn-ghost">
                  {t.today.viewList}
                </Link>
              </>
            ) : (
              <button onClick={generate} disabled={busy}>
                {busy ? t.today.generating : t.today.generate}
              </button>
            )}
          </div>
          <p className="sub" style={{ margin: "14px 0 0", fontSize: 11.5 }}>
            {t.today.flow}
          </p>
        </div>
      ) : (
        <>
          {progress && progress.total > 0 && (
            <div className="today-progress">
              <div className="progress">
                <span
                  className={`progress-fill${packDone ? " done" : ""}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="progress-meta today-progress-meta">
                <span>
                  {progress.chapterTotal > 0
                    ? t.today.progressChapters(
                        progressPct,
                        progress.chapterDone,
                        progress.chapterTotal,
                      )
                    : t.today.progressPlain(progressPct)}
                </span>
                <span>{t.today.plannedMinutes(totalMinutes)}</span>
              </div>
            </div>
          )}

          {packDone && pack.status === "confirmed" && (
            <div className="completion-banner">
              {t.today.doneTitle}
              <span className="sub">
                {t.today.doneSub(progress?.total ?? 0)}
              </span>
            </div>
          )}

          {pack.items.length === 0 ? (
            <p className="muted">{t.today.noReadable}</p>
          ) : (
            <div className="pack-cards">
              {pack.items.map((it, i) => {
                const planned = Math.max(1, it.planned_minutes);
                const minutes = Math.min(
                  planned,
                  Math.max(0, it.weread?.today_minutes ?? 0),
                );
                const todayPct = Math.min(
                  100,
                  Math.round((minutes / planned) * 100),
                );
                const autoTracked = Boolean(it.weread?.synced_at);
                const href = `/books/${it.document_id}?chapter=${it.chapter_ids[0]}&slice=${it.chapter_start}-${it.chapter_end}`;
                const chip = it.weread
                  ? t.today.wereadChip(it.planned_minutes)
                  : it.chapter_ids.length > 1
                    ? t.today.chapterRange(
                        it.chapter_start,
                        it.chapter_end,
                        it.planned_minutes,
                      )
                    : t.today.chapterOne(
                        it.chapter_start,
                        it.planned_minutes,
                      );
                return (
                  <article
                    className={`pack-card${it.weread ? " weread" : ""}`}
                    key={i}
                  >
                    <span className="chip">{chip}</span>
                    <h3 className="pack-card-title">
                      {it.weread ? (
                        <a
                          href={it.weread.readerLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {it.weread.title || t.today.unknownBook}
                        </a>
                      ) : (
                        <Link href={href}>
                          {names[it.document_id] ?? t.today.unknownBook}
                        </Link>
                      )}
                    </h3>
                    <p className="pack-card-by">
                      {names[it.theme_id] ?? t.today.unknownTheme} ·{" "}
                      {t.today.readingOrder(i + 1)}
                    </p>
                    {it.reason && <p className="pack-card-why">{it.reason}</p>}
                    {it.weread && (
                      <div className="weread-track">
                        <div className="weread-track-head">
                          <span>{t.today.todayReading}</span>
                          <strong>{todayPct}%</strong>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={planned}
                          step={1}
                          value={minutes}
                          aria-label={t.today.ariaMinutes}
                          onChange={(e) =>
                            previewTodayMinutes(it, Number(e.target.value))
                          }
                          onPointerUp={(e) =>
                            saveTodayMinutes(
                              it,
                              Number((e.target as HTMLInputElement).value),
                            )
                          }
                          onKeyUp={(e) =>
                            saveTodayMinutes(
                              it,
                              Number((e.target as HTMLInputElement).value),
                            )
                          }
                        />
                        <p className="hint">
                          {t.today.minutesRead(minutes, planned)}
                          {" · "}
                          {autoTracked
                            ? t.today.autoTracked
                            : t.today.manualTrack}
                        </p>
                      </div>
                    )}
                    <div className="pack-card-foot">
                      {it.weread ? (
                        <a
                          className="pack-card-go"
                          href={it.weread.readerLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t.today.openWeread} →
                        </a>
                      ) : (
                        <Link className="pack-card-go" href={href}>
                          {t.today.startReading} →
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p className="muted" style={{ margin: "14px 0 0" }}>
            {t.today.regenHelp}
          </p>
        </>
      )}
      {messageText && (
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {messageText}
        </p>
      )}
    </>
  );
}
