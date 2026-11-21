"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cacheChapter } from "@/lib/offline";
import { copy } from "@/lib/copy";

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

export default function DailyPackCard() {
  const supabase = createClient();

  const [pack, setPack] = useState<Pack | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // 首次拉取完成前不渲染空状态，避免「今天还没有可排的阅读包」闪一下
  const [loading, setLoading] = useState(true);
  // 离线或接口失败时的明确提示，避免一直停在「正在读取今日包…」
  const [loadError, setLoadError] = useState("");
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
    setLoadError(copy.dailyPack.cachedHint(cached.pack.date));
    setLoading(false);
    return true;
  }

  async function loadPack(withWereadSync = true) {
    setLoadError("");
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
      setLoadError(
        offlineNow ? copy.dailyPack.offline : copy.dailyPack.loadFailed,
      );
      setLoading(false);
      return;
    }
    if (!res.ok) {
      if (restoreCachedPack(uid)) return;
      setLoadError(copy.dailyPack.loadFailed);
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
    setMessage("");
    try {
      const res = await fetch("/api/daily-pack", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        if (json.empty) setMessage(copy.dailyPack.generateEmpty);
        else setMessage(copy.dailyPack.generated);
        loadPack();
      } else {
        setMessage(copy.dailyPack.generateFailed(json.error ?? res.status));
      }
    } catch {
      setMessage(copy.dailyPack.loadFailed);
    }
    setBusy(false);
  }

  const now = new Date();
  const dateLabel = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} · 星期${"日一二三四五六"[now.getDay()]}`;
  const totalMinutes =
    pack?.items.reduce((sum, it) => sum + (it.planned_minutes ?? 0), 0) ?? 0;

  return (
    <>
      <div className="page-head page-head-row">
        <div>
          <span className="kicker">{dateLabel}</span>
          <h1>
            {pack && pack.items.length > 0
              ? `今天读 ${pack.items.length} 份，约 ${totalMinutes} 分钟`
              : "今日阅读"}
          </h1>
        </div>
        {pack && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn-ghost btn-sm"
              onClick={generate}
              disabled={busy}
            >
              {busy ? "生成中…" : "重新生成"}
            </button>
          </div>
        )}
      </div>

      {pack && loadError && (
        <p className="muted" style={{ margin: "0 0 16px" }}>
          {loadError}
          <button
            className="link-btn"
            style={{ marginLeft: 8 }}
            onClick={() => loadPack()}
          >
            {copy.dailyPack.retry}
          </button>
        </p>
      )}

      {!pack && loading ? (
        <p className="muted">正在读取今日包…</p>
      ) : !pack && loadError ? (
        <div className="pack-empty">
          <p className="sub" style={{ margin: "0 0 12px" }}>
            {loadError}
          </p>
          <button
            className="btn-sm"
            onClick={() => {
              setLoading(true);
              loadPack();
            }}
          >
            {copy.dailyPack.retry}
          </button>
        </div>
      ) : !pack ? (
        <div className="pack-empty">
          <p className="sub" style={{ margin: "0 0 12px" }}>
            {setup === null
              ? copy.dailyPack.empty
              : setup.themes === 0
                ? copy.dailyPack.emptyNoTheme
                : setup.readable === 0
                  ? copy.dailyPack.emptyNoBooks
                  : copy.dailyPack.empty}
          </p>
          <div className="pack-empty-acts">
            {setup === null ? (
              <>
                <Link href="/themes" className="btn-sm btn-ghost">
                  主题与清单
                </Link>
                <Link href="/library" className="btn-sm btn-ghost">
                  书库
                </Link>
                <button onClick={generate} disabled={busy}>
                  {busy ? "生成中…" : "生成今日阅读包"}
                </button>
              </>
            ) : setup.themes === 0 ? (
              <Link href="/themes" className="btn-sm">
                创建第一个主题
              </Link>
            ) : setup.readable === 0 ? (
              <>
                <Link href="/library" className="btn-sm">
                  去书库上传
                </Link>
                <Link href="/themes" className="btn-sm btn-ghost">
                  查看清单
                </Link>
              </>
            ) : (
              <button onClick={generate} disabled={busy}>
                {busy ? "生成中…" : "生成今日阅读包"}
              </button>
            )}
          </div>
          <p className="sub" style={{ margin: "14px 0 0", fontSize: 11.5 }}>
            {copy.dailyPack.flow}
          </p>
        </div>
      ) : (
        <>
          {progress && progress.total > 0 && (
            <div style={{ margin: "0 0 26px" }}>
              <div className="progress">
                <span
                  className={`progress-fill${packDone ? " done" : ""}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="progress-meta">
                <span>
                  已完成 {progressPct}%
                  {progress.chapterTotal > 0 &&
                    ` · ${progress.chapterDone} / ${progress.chapterTotal} 章`}
                </span>
                <span>预计 {totalMinutes} 分钟</span>
              </div>
            </div>
          )}

          {packDone && pack.status === "confirmed" && (
            <div className="completion-banner">
              {copy.dailyPack.doneTitle}
              <span className="sub">
                {copy.dailyPack.doneSub(progress?.total ?? 0)}
              </span>
            </div>
          )}

          {pack.items.length === 0 ? (
            <p className="muted">{copy.dailyPack.noReadable}</p>
          ) : (
            pack.items.map((it, i) => {
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
              return (
              <div className="pack" key={i}>
                <div className="no">{String(i + 1).padStart(2, "0")}</div>
                <div className="body">
                  <p className="name">
                    {it.weread ? (
                      <a
                        href={it.weread.readerLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {it.weread.title || "微信读书"}
                      </a>
                    ) : (
                      <Link
                        href={`/books/${it.document_id}?chapter=${it.chapter_ids[0]}&slice=${it.chapter_start}-${it.chapter_end}`}
                      >
                        {names[it.document_id] ?? "未知书名"}
                      </Link>
                    )}
                  </p>
                  <p className="path">
                    {it.weread
                      ? `${names[it.theme_id] ?? "未知主题"} · 微信读书 · 建议 ${it.planned_minutes} 分钟`
                      : `${names[it.theme_id] ?? "未知主题"} · 第 ${it.chapter_start}–${it.chapter_end} 章 · ${it.chapter_ids.length} 章`}
                  </p>
                  {it.reason && <p className="why">{it.reason}</p>}
                  {it.weread && (
                    <div className="weread-track">
                      <div className="weread-track-head">
                        <span>今日阅读</span>
                        <strong>{todayPct}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={planned}
                        step={1}
                        value={minutes}
                        aria-label="今日已读分钟"
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
                        今日已读 {minutes} / {planned} 分钟
                        {autoTracked
                          ? "。按阅读时长自动计算，读满计划分钟就算完成今天这一档。"
                          : "。暂时读不到微信读书的阅读时长，可以手动拖一下。"}
                      </p>
                    </div>
                  )}
                  <div className="foot">
                    <span>约 {it.planned_minutes} 分钟</span>
                    <span className="act">
                      {it.weread ? (
                        <a
                          className="link-btn"
                          href={it.weread.readerLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          去微信读书阅读 →
                        </a>
                      ) : (
                        <Link
                          className="link-btn"
                          href={`/books/${it.document_id}?chapter=${it.chapter_ids[0]}&slice=${it.chapter_start}-${it.chapter_end}`}
                        >
                          开始阅读 →
                        </Link>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              );
            })
          )}

          <p className="muted" style={{ margin: "14px 0 0" }}>
            {copy.dailyPack.regenHelp}
          </p>
        </>
      )}
      {message && (
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {message}
        </p>
      )}
    </>
  );
}
