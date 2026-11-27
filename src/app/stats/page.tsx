"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { useI18n, type Dict, type Locale } from "@/i18n";
import { DOMAIN_KEYS, domainLabel, domainOrDefault } from "@/lib/domains";
import { formatDuration } from "@/lib/format";

type ThemeItem = {
  id: string;
  title: string;
  status: string;
  availability: string;
  document_id: string | null;
  key_points: string[];
  weread_progress: number | null;
  progress: number | null;
};

type ThemeStat = {
  id: string;
  name: string;
  domain: string | null;
  status: string;
  total: number;
  completed: number;
  current_title: string | null;
  current_document_id: string | null;
  items: ThemeItem[];
};

type CompletedItem = {
  id: string;
  title: string;
  theme: string;
  completed_at: string | null;
};

type Stats = {
  themes: ThemeStat[];
  domain_ready: boolean;
  unclassified: number;
  books: { completed_books: number; completed_chapters: number };
  words: { original: number; translated_estimate: number };
  completed_items: CompletedItem[];
  lists: ListStat[];
};

type ListStat = {
  id: string;
  theme: string;
  total_chapters: number;
  done_chapters: number;
  percent: number | null;
};

type ReadingTime = {
  today: {
    read_seconds: number;
    audio_seconds: number;
    planned_minutes: number | null;
  };
  days: { date: string; seconds: number }[];
};

function itemState(it: ThemeItem, t: Dict) {
  if (it.status === "completed") return t.stats.stateDone;
  if (it.status === "in_progress") return t.stats.stateReading;
  if (it.status === "skipped") return t.stats.stateSkipped;
  if (it.status === "shelved") return t.stats.stateShelved;
  if (it.availability === "pending_supplement") {
    return it.weread_progress !== null
      ? t.stats.wereadProgress(it.weread_progress)
      : t.stats.statePending;
  }
  return t.stats.stateNotStarted;
}

// 日期按界面语言显示：中文 2026.11.22，英文 Nov 22, 2026
function formatDay(iso: string, locale: Locale) {
  const d = new Date(iso);
  if (locale === "en") {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  }
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

function numberLocale(locale: Locale) {
  return locale === "en" ? "en-US" : "zh-CN";
}

function themePct(t: ThemeStat) {
  return t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
}

export default function StatsPage() {
  const { locale, t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [readingTime, setReadingTime] = useState<ReadingTime | null>(null);
  const [rtError, setRtError] = useState(false);
  const [message, setMessage] = useState("");
  const [openThemeId, setOpenThemeId] = useState<string | null>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);

  async function loadStats() {
    try {
      const res = await fetch("/api/stats");
      const json = await res.json();
      if (json.error) setMessage(json.error);
      else setStats(json as Stats);
    } catch {
      setMessage(t.stats.loadFailed);
    }
  }

  useEffect(() => {
    loadStats();
    loadReadingTime();
  }, []);

  // 时长聚合独立取：表未迁移或接口失败时不显示该模块，不影响其余统计
  async function loadReadingTime() {
    try {
      const res = await fetch("/api/stats/reading-time?days=30");
      if (!res.ok) {
        setRtError(true);
        return;
      }
      const json = await res.json();
      if (json.error) setRtError(true);
      else setReadingTime(json as ReadingTime);
    } catch {
      setRtError(true);
    }
  }

  // 归类改为显式点击：避免每次打开统计页都触发一次 AI 调用
  async function classifyThemes() {
    setClassifying(true);
    setMessage("");
    try {
      const res = await fetch("/api/themes/classify", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 接口已按界面语言返回报错，这里只把「缺 Key」替换成带 README 指引的版本
        setMessage(
          json.error === "未配置 AI_API_KEY 或 DEEPSEEK_API_KEY" ||
            json.error === "AI_API_KEY or DEEPSEEK_API_KEY is not configured" ||
            json.error === "未配置 DEEPSEEK_API_KEY" ||
            json.error === "DEEPSEEK_API_KEY is not configured"
            ? t.stats.classifyNoKey
            : json.error || t.stats.classifyFailed,
        );
        return;
      }
      if (json.updated > 0) await loadStats();
    } catch {
      setMessage(t.stats.classifyFailed);
    } finally {
      setClassifying(false);
    }
  }

  function closeTheme() {
    setOpenThemeId(null);
    setLiftedId(null);
  }

  function exportMarkdown() {
    if (!stats) return;
    const lines: string[] = [t.stats.exportTitle, ""];
    for (const it of stats.completed_items) {
      const time = it.completed_at ? formatDay(it.completed_at, locale) : "—";
      lines.push(`- ${it.title}（${it.theme}） · ${time}`);
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t.stats.exportFileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  const overallTotal = stats
    ? stats.themes.reduce((sum, t) => sum + t.total, 0)
    : 0;
  const overallCompleted = stats
    ? stats.themes.reduce((sum, t) => sum + t.completed, 0)
    : 0;
  const overallPct =
    overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;
  const finishedThemes = stats
    ? stats.themes.filter((t) => t.total > 0 && t.completed >= t.total).length
    : 0;

  // 阅读时长：今日实际 / 预算缺口 + 30 天柱状趋势
  const rt = readingTime;
  const rtMinutes = rt ? Math.round(rt.today.read_seconds / 60) : 0;
  const rtPlanned = rt?.today.planned_minutes ?? null;
  const rtGap = rtPlanned !== null ? rtPlanned - rtMinutes : 0;
  const rtAudioMinutes = rt ? Math.round(rt.today.audio_seconds / 60) : 0;
  // 图表按实际数据定标（下限 10 分钟）；预算远超实际时不再画进图里，
  // 否则 1 分钟的柱子会被 70 分钟的预算压成一个点
  const rtMax = Math.max(600, ...(rt?.days ?? []).map((d) => d.seconds));
  const rtBudgetInChart =
    rtPlanned !== null && rtPlanned > 0 && rtPlanned * 60 <= rtMax;
  const rtHasData = (rt?.days ?? []).some((d) => d.seconds > 0);
  // 最近读完日期，用于右上角小字
  const lastDoneLabel = useMemo(() => {
    const times = (stats?.completed_items ?? [])
      .map((it) => it.completed_at)
      .filter((v): v is string => Boolean(v))
      .sort();
    const last = times[times.length - 1];
    return last ? formatDay(last, locale) : "";
  }, [stats, locale]);

  // 按固定领域顺序分篮子，空领域不显示
  const groups = useMemo(() => {
    if (!stats) return [];
    const map = new Map<string, ThemeStat[]>();
    for (const t of stats.themes) {
      const d = domainOrDefault(t.domain);
      const arr = map.get(d) ?? [];
      arr.push(t);
      map.set(d, arr);
    }
    return DOMAIN_KEYS.filter((d) => (map.get(d)?.length ?? 0) > 0).map((d) => ({
      domain: d,
      themes: map.get(d) ?? [],
    }));
  }, [stats]);

  const openTheme = stats?.themes.find((t) => t.id === openThemeId) ?? null;

  return (
    <>
      <AppNav />
      <div className="container app-main">
        <div className="page-head page-head-row">
          <div>
            <span className="kicker">{t.stats.kicker}</span>
            <h1>{t.stats.title}</h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {stats && stats.unclassified > 0 && (
              <button
                className="btn-ghost btn-sm"
                onClick={classifyThemes}
                disabled={classifying}
                title={t.stats.classifyHint}
              >
                {classifying
                  ? t.stats.classifying
                  : t.stats.classifyBtn(stats.unclassified)}
              </button>
            )}
            {stats && stats.completed_items.length > 0 && (
              <button className="btn-ghost btn-sm" onClick={exportMarkdown}>
                {t.stats.exportRead}
              </button>
            )}
          </div>
        </div>

        {message && <p className="message err">{message}</p>}

        {!stats ? (
          <p className="muted">{t.stats.loading}</p>
        ) : stats.themes.length === 0 ? (
          <div className="empty-guide">
            <span className="kicker">{t.stats.emptyKicker}</span>
            <h2>{t.stats.emptyTitle}</h2>
            <p>{t.stats.emptyDesc}</p>
            <div className="empty-actions">
              <Link href="/themes" className="empty-primary">
                {t.stats.emptyCta}
              </Link>
              <Link href="/library" className="empty-secondary">
                {t.stats.emptyCtaLibrary}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <section>
              {overallTotal === 0 ? (
                <p className="muted">{t.stats.noItems}</p>
              ) : (
                <>
                  <div className="hero-row">
                    <div className="hero-main">
                      <div className="stat-hero">{overallPct}%</div>
                      <div className="progress">
                        <span
                          className={`progress-fill${overallPct >= 100 ? " done" : ""}`}
                          style={{ width: `${overallPct}%` }}
                        />
                      </div>
                      <div className="progress-meta">
                        <span>{t.stats.overallLabel}</span>
                        <span>
                          {t.stats.overallMeta(
                            overallCompleted,
                            overallTotal,
                            finishedThemes,
                            stats.themes.length,
                          )}
                        </span>
                      </div>
                    </div>
                    {stats.completed_items.length > 0 && (
                      <div className="hero-side">
                        {t.stats.finishedTitle}
                        <br />
                        {t.stats.finishedCount(stats.completed_items.length)}
                        {lastDoneLabel ? t.stats.lastFinished(lastDoneLabel) : ""}
                      </div>
                    )}
                  </div>
                  {overallPct >= 100 && (
                    <div
                      className="completion-banner"
                      style={{ marginTop: 18, marginBottom: 0 }}
                    >
                      {t.stats.allDoneTitle}
                      <span className="sub">{t.stats.allDoneSub}</span>
                    </div>
                  )}
                </>
              )}

              <div className="stat-strip">
                <div className="cell">
                  <div className="k">{t.stats.statBooks}</div>
                  <div className="v">
                    {stats.books.completed_books}
                    <small>{t.stats.unitBook}</small>
                  </div>
                </div>
                <div className="cell">
                  <div className="k">{t.stats.statChapters}</div>
                  <div className="v">
                    {stats.books.completed_chapters}
                    <small>{t.stats.unitChapter}</small>
                  </div>
                </div>
                <div className="cell">
                  <div className="k">{t.stats.statWords}</div>
                  <div className="v">
                    {stats.words.original.toLocaleString(numberLocale(locale))}
                    <small>{t.stats.unitWord}</small>
                  </div>
                </div>
              </div>
              <p className="stat-note">
                {t.stats.statNote(
                  stats.words.translated_estimate.toLocaleString(
                    numberLocale(locale),
                  ),
                )}
              </p>
            </section>

            {rt ? (
              <section className="rt-card">
                <div className="rt-head">
                  <span className="kicker">{t.stats.timeKicker}</span>
                  <span className="hint">{t.stats.timeHint}</span>
                </div>

                <div className="rt-hero">
                  <div>
                    <div className="rt-value">
                      {rtMinutes}
                      <small>{t.stats.unitMinute}</small>
                    </div>
                    <div className="rt-meta">
                      <span>{t.stats.timeToday}</span>
                      {rtPlanned !== null ? (
                        <>
                          <span>{t.stats.timeBudget(rtPlanned)}</span>
                          {rtGap >= 0 ? (
                            <span className="rt-gap">
                              {t.stats.timeGap(rtGap)}
                            </span>
                          ) : (
                            <span className="rt-over">
                              {t.stats.timeOver(-rtGap)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span>{t.stats.timeNoPack}</span>
                      )}
                      {rtAudioMinutes >= 1 && (
                        <span className="rt-audio">
                          {t.stats.timeAudio(rtAudioMinutes)}
                        </span>
                      )}
                    </div>
                    {rtPlanned !== null && rtPlanned > 0 && (
                      <div className="rt-goal">
                        <span
                          style={{
                            width: `${Math.min(
                              100,
                              (rtMinutes / rtPlanned) * 100,
                            )}%`,
                            minWidth: rtMinutes > 0 ? 4 : 0,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="rt-window">{t.stats.timeTrend}</span>
                </div>

                {rtHasData || rtMinutes > 0 ? (
                  <>
                    <div className="rt-chart">
                      {rtPlanned !== null &&
                        rtPlanned > 0 &&
                        rtBudgetInChart && (
                          <span
                            className="rt-budget-line"
                            style={{
                              bottom: `${Math.min(
                                100,
                                ((rtPlanned * 60) / rtMax) * 100,
                              )}%`,
                            }}
                            title={t.stats.timeBudget(rtPlanned)}
                          />
                        )}
                      {rt.days.map((d, i) => (
                        <span
                          key={d.date}
                          className={`rt-bar${
                            d.seconds === 0 ? " empty" : ""
                          }${i === rt.days.length - 1 ? " today" : ""}`}
                          style={{
                            height: `${(d.seconds / rtMax) * 100}%`,
                          }}
                          title={`${formatDay(d.date, locale)} · ${formatDuration(
                            Math.round(d.seconds / 60),
                            locale,
                          )}`}
                        />
                      ))}
                    </div>
                    <div className="rt-axis">
                      <span>{formatDay(rt.days[0].date, locale)}</span>
                      <span>
                        {formatDay(rt.days[rt.days.length - 1].date, locale)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="rt-empty">{t.stats.timeNoData}</p>
                )}
              </section>
            ) : rtError ? (
              <section className="rt-card">
                <p className="rt-empty">{t.stats.timeUnavailable}</p>
              </section>
            ) : null}

            {stats.lists.length > 0 && (
              <section className="cl-card">
                <div className="rt-head">
                  <span className="kicker">{t.stats.listKicker}</span>
                  <span className="hint">{t.stats.listHint}</span>
                </div>
                <div className="cl-rows">
                  {stats.lists.map((l) => (
                    <div className="cl-row" key={l.id}>
                      <span className="cl-name" title={l.theme}>
                        {l.theme}
                      </span>
                      <span className="cl-bar">
                        <span
                          className="cl-fill"
                          style={{ width: `${l.percent ?? 0}%` }}
                        />
                      </span>
                      <span className="cl-meta">
                        {l.percent === null
                          ? "—"
                          : t.stats.listMeta(
                              l.done_chapters,
                              l.total_chapters,
                              l.percent,
                            )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="stats-section">
              <div className="card-head">
                <span className="kicker">{t.stats.domainKicker}</span>
                <span style={{ fontSize: 10.5, color: "var(--ft-faint)" }}>
                  {t.stats.domainHint}
                </span>
              </div>

              {!stats.domain_ready && (
                <p className="message" style={{ marginTop: 4 }}>
                  {t.stats.domainNotReady}
                </p>
              )}

              {stats.themes.length === 0 ? (
                <p className="muted">{t.stats.noThemes}</p>
              ) : (
                <div className="baskets">
                  {groups.map((g, gi) => {
                    const books = g.themes.reduce((s, th) => s + th.total, 0);
                    const done = g.themes.reduce(
                      (s, th) => s + th.completed,
                      0,
                    );
                    const pct = books > 0 ? Math.round((done / books) * 100) : 0;
                    const n = g.themes.length;
                    const fit = n > 1 ? (100 - 43.5) / (n - 1) : 10;
                    const gap = Math.min(14, fit);
                    const gapHover = n === 2 ? 22 : gap;
                    return (
                      <div className="basket-block" key={g.domain}>
                        <div className="domain-head">
                          <h2>{domainLabel(g.domain, locale)}</h2>
                          <span className="meta">
                            {t.stats.domainMeta(n, books, pct)}
                          </span>
                        </div>
                      <div className="basket" onClick={() => setLiftedId(null)}>
                        {/* 后层：托盘后壁与内壁 */}
                        <svg
                          className="box back"
                          viewBox="0 0 360 330"
                          fill="none"
                          aria-hidden="true"
                        >
                          <defs>
                            <linearGradient
                              id={`bx-in-${gi}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0"
                                stopColor="#111827"
                                stopOpacity=".2"
                              />
                              <stop
                                offset="1"
                                stopColor="#111827"
                                stopOpacity="0"
                              />
                            </linearGradient>
                          </defs>
                          <ellipse
                            cx="180"
                            cy="312"
                            rx="136"
                            ry="8"
                            fill="#111827"
                            opacity=".06"
                          />
                          <path
                            d="M54 168 H306 V296 Q306 306 294 306 H66 Q54 306 54 296 Z"
                            fill="#f1efe9"
                            stroke="#111827"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M54 168 H306 V226 H54 Z"
                            fill={`url(#bx-in-${gi})`}
                          />
                        </svg>

                        <div
                          className="basket-cards"
                          style={
                            {
                              "--gap": `${gap}%`,
                              "--gap-h": `${gapHover}%`,
                            } as CSSProperties
                          }
                        >
                          {g.themes.map((th, i) => {
                            const p = themePct(th);
                            const isDone =
                              th.total > 0 && th.completed >= th.total;
                            const points = th.items.reduce(
                              (s, it) => s + it.key_points.length,
                              0,
                            );
                            return (
                              <button
                                type="button"
                                className={`basket-card${liftedId === th.id ? " is-lifted" : ""}`}
                                key={th.id}
                                style={{ "--i": i } as CSSProperties}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (liftedId === th.id) setOpenThemeId(th.id);
                                  else setLiftedId(th.id);
                                }}
                              >
                                <span className="basket-name">{th.name}</span>
                                <span className="basket-meta">
                                  {t.stats.basketMeta(th.total, th.completed)}
                                  {th.status === "priority"
                                    ? ` · ${t.stats.priorityTag}`
                                    : ""}
                                </span>
                                <span className="basket-track">
                                  <span
                                    className={isDone ? "done" : ""}
                                    style={{ width: `${p}%` }}
                                  />
                                </span>
                                <span className="basket-foot">
                                  <span>{p}%</span>
                                  <span>{t.stats.keyPoints(points)}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* 前壁：压在卡片上，挡住卡脚 */}
                        <svg
                          className="box front"
                          viewBox="0 0 360 330"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M40 196 H320 V292 Q320 308 300 308 H60 Q40 308 40 292 Z"
                            fill="#fbfaf7"
                            stroke="#111827"
                            strokeWidth="2"
                          />
                          <path
                            d="M56 214 H304"
                            stroke="#111827"
                            strokeOpacity=".18"
                            strokeWidth="1.2"
                          />
                        </svg>

                        <span className="box-label">
                          {books > 0
                            ? t.stats.booksCount(books)
                            : t.stats.emptyBox}
                        </span>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </section>

            <section className="stats-section">
              <div className="card-head done-head">
                <span className="kicker">{t.stats.finishedTitle}</span>
                {stats.completed_items.length > 0 && (
                  <button
                    className="btn-mini-line"
                    onClick={exportMarkdown}
                  >
                    {t.stats.exportRead}
                  </button>
                )}
              </div>
              {stats.completed_items.length === 0 ? (
                <p className="muted">{t.stats.noFinished}</p>
              ) : (
                <div className="done-list">
                  {stats.completed_items.map((it) => (
                    <div className="done-row" key={it.id}>
                      <div>
                        <span className="t">{it.title}</span>
                        <span className="m"> · {it.theme}</span>
                      </div>
                      {it.completed_at && (
                        <span className="d">
                          {formatDay(it.completed_at, locale)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* 清单抽屉：桌面右侧滑出，手机底部弹出 */}
      {openTheme && (
        <>
          <div
            className="drawer-overlay"
            onClick={closeTheme}
          />
          <aside className="drawer sheet">
            <div className="drawer-head">
              <div style={{ minWidth: 0 }}>
                <span className="kicker">
                  {domainLabel(openTheme.domain, locale)}
                </span>
                <h2 style={{ marginTop: 4 }}>{openTheme.name}</h2>
              </div>
              <button
                className="btn-quiet btn-sm"
                onClick={closeTheme}
              >
                {t.stats.close}
              </button>
            </div>

            <div className="progress">
              <span
                className={`progress-fill${themePct(openTheme) >= 100 ? " done" : ""}`}
                style={{ width: `${themePct(openTheme)}%` }}
              />
            </div>
            <div className="progress-meta">
              <span>
                {t.stats.itemsProgress(openTheme.completed, openTheme.total)}
              </span>
              <span>{themePct(openTheme)}%</span>
            </div>

            <div style={{ marginTop: 16 }}>
              {openTheme.items.length === 0 ? (
                <p className="muted" style={{ fontSize: 12 }}>
                  {t.stats.drawerEmpty}
                </p>
              ) : (
                openTheme.items.map((it, idx) => (
                  <div className="basket-book" key={it.id}>
                    <div className="basket-book-head">
                      <span className="idx">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      {it.document_id ? (
                        <Link
                          className="t"
                          href={`/books/${it.document_id}`}
                          onClick={closeTheme}
                        >
                          {it.title}
                        </Link>
                      ) : (
                        <span className="t">{it.title}</span>
                      )}
                      <span className="chip">{itemState(it, t)}</span>
                    </div>
                    {it.progress !== null && (
                      <div className="basket-book-prog">
                        <span className="track">
                          <span
                            className="bar"
                            style={{ width: `${it.progress}%` }}
                          />
                        </span>
                        <span className="label">{it.progress}%</span>
                      </div>
                    )}
                    {it.key_points.length > 0 && (
                      <div className="basket-points">
                        {it.key_points.map((p) => (
                          <span className="chip" key={p}>
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
              {t.stats.drawerEditDomain}
              <Link href="/themes">{t.stats.drawerGoThemes}</Link>
            </p>
          </aside>
        </>
      )}
    </>
  );
}
