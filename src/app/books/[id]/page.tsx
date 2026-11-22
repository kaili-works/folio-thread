"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n";
import Guide from "@/components/Guide";
import AudioReader from "@/components/AudioReader";
import { Icon } from "@/components/Icon";
import {
  getCachedChapter,
  queueComplete,
  syncQueuedCompletes,
} from "@/lib/offline";
const COLOR_HEX: Record<string, string> = {
  yellow: "#f59e0b",
  blue: "#3b82f6",
  green: "#10b981",
};

type ChapterBundle = {
  chapter: any;
  paragraphs: any[];
  notes: any[];
  completed: boolean;
};

// zh、zh-CN、zh-Hans、zh-Hant 等都视为中文，不做机器翻译
function isChineseLang(lang: string | null | undefined) {
  return !!lang && lang.toLowerCase().startsWith("zh");
}

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    chapter: params.get("chapter"),
    paragraph: params.get("paragraph"),
    slice: params.get("slice"),
  };
}

export default function BookReader() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useI18n();
  const supabase = createClient();

  const [doc, setDoc] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [activeChapter, setActiveChapter] = useState<any>(null);
  const [paragraphs, setParagraphs] = useState<any[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showTranslation, setShowTranslation] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 网络较慢时给出状态说明，避免只看到「加载中…」不知道是否卡死
  const [slowLoad, setSlowLoad] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [offline, setOffline] = useState(false);

  // 译文语言跟随界面语言：切换后清空旧译文，避免英文界面显示中文译文
  useEffect(() => {
    setTranslations({});
  }, [locale]);

  // 笔记
  const [annotations, setAnnotations] = useState<Record<string, any>>({});
  const [noteComment, setNoteComment] = useState("");
  const [noteColor, setNoteColor] = useState("yellow");
  const [noteMessage, setNoteMessage] = useState("");

  // 完成本章
  const [userId, setUserId] = useState<string | null>(null);
  const [completeMessage, setCompleteMessage] = useState("");
  const [chapterCompleted, setChapterCompleted] = useState(false);
  const [completedChapters, setCompletedChapters] = useState<Set<string>>(
    new Set(),
  );
  const [completing, setCompleting] = useState(false);

  // 章节内存缓存：访问过的章节再次打开（上一章/下一章）不再请求数据库
  const chapterCache = useRef(new Map<string, ChapterBundle>());
  const chaptersRef = useRef<any[]>([]);

  // 封面与正文图片（私有 bucket，需签名 URL）
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // 每日包切片：slice = "start-end"（章节 order_index 范围）
  const [sliceRange, setSliceRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [showAllChapters, setShowAllChapters] = useState(false);

  // 移动端目录抽屉
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 「设置」弹层与「听书」唤起信号
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioSignal, setAudioSignal] = useState(0);

  // 字号调节（正文，15~24px，localStorage 持久化）
  const FONT_MIN = 15;
  const FONT_MAX = 24;
  const [fontSize, setFontSize] = useState<number>(16.5);

  // 字号偏好挂载后再读，避免服务端 16.5 与客户端 17 的 hydration 不一致
  useEffect(() => {
    const v = parseInt(localStorage.getItem("reader-font-size") ?? "", 10);
    if (Number.isFinite(v)) {
      setFontSize(Math.min(FONT_MAX, Math.max(FONT_MIN, v)));
    }
  }, []);

  function changeFontSize(delta: number) {
    setFontSize((prev) => {
      const next = Math.min(FONT_MAX, Math.max(FONT_MIN, prev + delta));
      localStorage.setItem("reader-font-size", String(next));
      return next;
    });
  }

  // 主题：light / dark / system
  const THEME_KEY = "reader-theme";
  const [themePref, setThemePref] = useState<string>(() => {
    if (typeof window === "undefined") return "system";
    return localStorage.getItem(THEME_KEY) ?? "system";
  });

  function applyTheme(value: string) {
    setThemePref(value);
    localStorage.setItem(THEME_KEY, value);
    const el = document.documentElement;
    if (value === "dark") el.setAttribute("data-theme", "dark");
    else if (value === "light") el.setAttribute("data-theme", "light");
    else {
      const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      el.setAttribute("data-theme", dark ? "dark" : "light");
    }
  }

  useEffect(() => {
    applyTheme(themePref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themePref]);

  const isChinese = isChineseLang(doc?.language);

  async function signPaths(paths: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(paths.filter(Boolean))];
    if (unique.length === 0) return {};
    const res = await fetch("/api/storage/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: unique }),
    });
    const json = await res.json().catch(() => ({}));
    return json.urls ?? {};
  }

  useEffect(() => {
    if (!loading) {
      setSlowLoad(false);
      return;
    }
    const timer = setTimeout(() => setSlowLoad(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    async function init() {
      const { chapter, paragraph, slice } = getQueryParams();
      if (slice) {
        const [a, b] = slice.split("-").map((s) => parseInt(s, 10));
        if (!Number.isNaN(a) && !Number.isNaN(b)) {
          setSliceRange({ start: Math.min(a, b), end: Math.max(a, b) });
        }
      }

      // 服务端聚合接口：一次请求拿全书籍、目录、今日切片与封面签名，
      // 避免移动端直连 Supabase 发多次请求导致首屏长时间空白
      let payload: any = null;
      try {
        const res = await fetch(`/api/books/${id}/reader`, {
          cache: "no-store",
        });
        if (res.ok) payload = await res.json();
        else if (res.status === 403 || res.status === 404) setNotFound(true);
      } catch {
        // 网络失败时保留加载态，由章节的离线缓存兜底
      }

      // 登录态只用于离线缓存与离线完成队列，不阻塞首屏渲染
      supabase.auth.getSession().then(({ data }) => {
        const uid = data.session?.user?.id ?? null;
        setUserId(uid);
        if (uid) syncQueuedCompletes(uid);
      });

      if (!payload) {
        // 离线直接进阅读器时，仍尝试用本地缓存的章节渲染
        if (chapter) await openChapter(chapter, paragraph ?? undefined);
        return;
      }

      const docData = payload.document;
      setDoc(docData);
      setNotFound(false);
      const list = payload.chapters ?? [];
      setChapters(list);
      chaptersRef.current = list;
      setCompletedChapters(new Set(payload.completed_chapter_ids ?? []));
      if (payload.cover_url) setCoverUrl(payload.cover_url);

      const todayItem = payload.today_item;
      if (
        !chapter &&
        !slice &&
        todayItem?.chapter_start != null &&
        todayItem?.chapter_end != null
      ) {
        setSliceRange({
          start: todayItem.chapter_start,
          end: todayItem.chapter_end,
        });
      }
      const targetChapter = chapter ?? payload.opened_chapter_id;
      if (targetChapter) {
        // 首屏章节已随聚合接口返回，不再单独请求
        await openChapter(
          targetChapter,
          chapter ? (paragraph ?? undefined) : undefined,
          payload.chapter,
        );
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function translateParagraphs(ids: string[]) {
    setTranslating(true);
    setTranslations({});
    setTranslateError("");
    try {
      // 服务端单次最多 40 段，长章节需要分批，否则整章会被 400 拒绝
      const BATCH = 40;
      const merged: Record<string, string> = {};
      let failed = 0;
      for (let i = 0; i < ids.length; i += BATCH) {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paragraphIds: ids.slice(i, i + BATCH) }),
        });
        const json = await res.json().catch(() => ({}));
        if (json.translations) Object.assign(merged, json.translations);
        if (Array.isArray(json.failed)) failed += json.failed.length;
        if (!res.ok) {
          const msg = typeof json.error === "string" ? json.error : "";
          setTranslateError(
            msg.includes("DEEPSEEK_API_KEY")
              ? t.reader.noApiKey
              : msg || t.reader.translateFailed,
          );
          break;
        }
      }
      setTranslations(merged);
      // 部分或全部段落翻译失败时，服务端返回的是原文，明确告诉用户
      if (failed > 0) setTranslateError(t.reader.translateFailed);
    } catch {
      // 翻译失败：保持原文显示
      setTranslateError(t.reader.translateFailed);
    }
    setTranslating(false);
  }

  async function prefetchChapter(chapterId: string) {
    if (chapterCache.current.has(chapterId)) return;
    try {
      const res = await fetch(
        `/api/books/${id}/reader?chapter=${encodeURIComponent(chapterId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = await res.json();
      const box = json.chapter;
      if (box?.chapter && box?.paragraphs) {
        chapterCache.current.set(chapterId, {
          chapter: box.chapter,
          paragraphs: box.paragraphs,
          notes: box.notes ?? [],
          completed: Boolean(box.completed),
        });
      }
    } catch {
      // 预取失败不影响当前阅读
    }
  }

  async function openChapter(
    chapterId: string,
    targetParagraph?: string,
    preloaded?: any,
  ) {
    setLoading(true);
    setSelected(null);
    setNoteMessage("");
    setCompleteMessage("");
    setTranslateError("");
    setChapterCompleted(false);
    setOffline(false);
    setSidebarOpen(false);

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    let ch: any = null;
    let data: any[] | null = null;
    let notes: any[] = [];
    let isCompleted = false;
    // 接口已带回签名 URL 的图片，避免重复签名
    const providedImages = new Set<string>();

    // 访问过的章节走内存缓存，上一章/下一章基本瞬时打开
    const cached = !isOffline ? chapterCache.current.get(chapterId) : undefined;

    if (cached) {
      ch = cached.chapter;
      data = cached.paragraphs;
      notes = cached.notes;
      isCompleted = cached.completed;
    } else if (preloaded) {
      ch = preloaded.chapter ?? null;
      data = preloaded.paragraphs ?? [];
      notes = preloaded.notes ?? [];
      isCompleted = Boolean(preloaded.completed);
      if (preloaded.image_urls) {
        for (const path of Object.keys(preloaded.image_urls)) {
          providedImages.add(path);
        }
        setImageUrls((prev) => ({ ...prev, ...preloaded.image_urls }));
      }
      if (ch && data) {
        chapterCache.current.set(chapterId, {
          chapter: ch,
          paragraphs: data,
          notes,
          completed: isCompleted,
        });
      }
    } else if (!isOffline) {
      try {
        const res = await fetch(
          `/api/books/${id}/reader?chapter=${encodeURIComponent(chapterId)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const json = await res.json();
          const box = json.chapter;
          ch = box?.chapter ?? null;
          data = box?.paragraphs ?? [];
          notes = box?.notes ?? [];
          isCompleted = Boolean(box?.completed);
          if (box?.image_urls) {
            for (const path of Object.keys(box.image_urls)) {
              providedImages.add(path);
            }
            setImageUrls((prev) => ({ ...prev, ...box.image_urls }));
          }
          if (ch && data) {
            if (chapterCache.current.size >= 8) {
              const oldest = chapterCache.current.keys().next().value;
              if (oldest) chapterCache.current.delete(oldest);
            }
            chapterCache.current.set(chapterId, {
              chapter: ch,
              paragraphs: data,
              notes,
              completed: isCompleted,
            });
          }
        } else {
          ch = null;
          data = null;
        }
      } catch {
        ch = null;
        data = null;
      }
    }

    // 离线或请求失败时，回退到离线缓存
    if (!ch || data === null) {
      const uid =
        userId ?? (await supabase.auth.getSession()).data.session?.user?.id;
      if (uid) {
        try {
          const cached = await getCachedChapter(uid, chapterId);
          if (cached) {
            ch = cached.chapter;
            data = cached.paragraphs ?? [];
            setOffline(true);
          }
        } catch {
          // 忽略，走空态
        }
      }
    }

    setActiveChapter(ch ?? null);
    setParagraphs(data ?? []);
    setChapterCompleted(isCompleted);
    setLoading(false);

    // 离线缓存里的图片段没有签名 URL，联网时补签（在线数据由接口直接返回）
    const imgPaths = (data ?? [])
      .filter(
        (p) =>
          p.image_path &&
          !providedImages.has(p.image_path) &&
          !imageUrls[p.image_path],
      )
      .map((p) => p.image_path);
    if (imgPaths.length > 0 && !isOffline) {
      const urls = await signPaths(imgPaths);
      setImageUrls((prev) => ({ ...prev, ...urls }));
    }

    const noteMap: Record<string, any> = {};
    for (const n of notes) noteMap[n.paragraph_id] = n;
    setAnnotations(noteMap);

    // 翻译改为显式触发（避免打开一本书就产生 AI 费用）：换章只清空
    setTranslations({});
    setTranslating(false);
    setTranslateError("");

    // 预取前后各一章，翻页时直接命中缓存
    if (!isOffline) {
      const list = chaptersRef.current;
      const idx = list.findIndex((c) => c.id === chapterId);
      if (idx >= 0) {
        for (const offset of [-1, 1]) {
          const target = list[idx + offset];
          if (target) void prefetchChapter(target.id);
        }
      }
    }

    if (targetParagraph) {
      setSelected(targetParagraph);
      setTimeout(() => {
        document
          .getElementById(`para-${targetParagraph}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
    }
  }

  async function saveNote() {
    if (!selected) return;
    setNoteMessage("");
    const res = await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paragraph_id: selected,
        comment: noteComment,
        color: noteColor,
      }),
    });
    if (res.status === 401) {
      await supabase.auth.signOut();
      setNoteMessage(t.reader.sessionExpired);
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
      return;
    }
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.annotation) {
      setAnnotations((prev) => ({ ...prev, [selected]: json.annotation }));
      const entry = activeChapter
        ? chapterCache.current.get(activeChapter.id)
        : undefined;
      if (entry) {
        entry.notes = [
          ...entry.notes.filter((n: any) => n.paragraph_id !== selected),
          json.annotation,
        ];
      }
      setNoteMessage(t.reader.noteSaved);
    } else {
      setNoteMessage(t.reader.noteFailed(json.error ?? res.status));
    }
  }

  async function completeChapter() {
    if (!activeChapter || completing || chapterCompleted) return;
    const chapterId = activeChapter.id;
    const uid =
      userId ?? (await supabase.auth.getSession()).data.session?.user?.id;
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    // 先更新界面，网络请求在后台完成，点击立刻有反馈
    setChapterCompleted(true);
    setCompletedChapters((prev) => new Set(prev).add(chapterId));
    setCompleteMessage(
      isOffline ? t.reader.offlineSaved : t.reader.chapterCompleted,
    );
    setCompleting(true);

    const entry = chapterCache.current.get(chapterId);
    if (entry) entry.completed = true;

    function rollback() {
      setChapterCompleted(false);
      setCompletedChapters((prev) => {
        const next = new Set(prev);
        next.delete(chapterId);
        return next;
      });
      if (entry) entry.completed = false;
    }

    if (isOffline && uid) {
      await queueComplete(uid, chapterId);
      setCompleting(false);
      return;
    }

    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_id: chapterId }),
      });
      if (res.status === 401) {
        await supabase.auth.signOut();
        setCompleteMessage(t.reader.sessionExpired);
        setTimeout(() => {
          window.location.href = "/";
        }, 1200);
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        if (json.bookCompleted) setCompleteMessage(t.reader.bookCompleted);
      } else {
        rollback();
        setCompleteMessage(t.reader.completeFailed(json.error ?? res.status));
      }
    } catch {
      rollback();
      setCompleteMessage(t.reader.completeFailed("network"));
    } finally {
      setCompleting(false);
    }
  }

  const activeChapterIndex = activeChapter
    ? chapters.findIndex((c) => c.id === activeChapter.id)
    : -1;
  const hasPrevChapter = activeChapterIndex > 0;
  const hasNextChapter =
    activeChapterIndex >= 0 && activeChapterIndex < chapters.length - 1;

  function goAdjacentChapter(offset: number) {
    if (activeChapterIndex < 0) return;
    const target = chapters[activeChapterIndex + offset];
    if (target) openChapter(target.id);
  }

  const totalChapters = chapters.length;
  const readChapters = completedChapters.size;
  const readPct = totalChapters
    ? Math.round((readChapters / totalChapters) * 100)
    : 0;

  return (
    <div className="reader">
      <aside className={`reader-sidebar ${sidebarOpen ? "open" : ""}`}>
        <Link href="/today" className="reader-back">
          {t.reader.backToday}
        </Link>
        <div className="reader-book-title">
          {doc?.title ?? (notFound ? t.reader.notFound : t.reader.loading)}
        </div>
        <div className="reader-lang">
          {isChinese ? t.reader.langZh : t.reader.langOther} ·{" "}
          {t.reader.chaptersMeta(totalChapters, readChapters)}
        </div>
        <div className="reader-progress">
          <div className="reader-track">
            <i style={{ width: `${readPct}%` }} />
          </div>
          <div className="reader-track-meta">
            <span>{readPct}%</span>
            <span>
              {t.reader.progressChapters(readChapters, totalChapters)}
            </span>
          </div>
        </div>
        {coverUrl && (
          <img className="reader-cover" src={coverUrl} alt={doc?.title ?? ""} />
        )}
        <nav>
          {(() => {
            const inSlice = sliceRange
              ? chapters.filter(
                  (c) =>
                    c.order_index >= sliceRange.start &&
                    c.order_index <= sliceRange.end,
                )
              : chapters;
            const inSliceIds = new Set(inSlice.map((c) => c.id));
            const others = chapters.filter((c) => !inSliceIds.has(c.id));
            const doneOthers = others.filter((c) => completedChapters.has(c.id));
            const rest = others.filter((c) => !completedChapters.has(c.id));

            const renderChapter = (c: any, highlight: boolean) => (
              <button
                key={c.id}
                className={`chapter-item ${highlight ? "in-slice" : ""} ${
                  activeChapter?.id === c.id ? "active" : ""
                }`}
                style={{ paddingLeft: `${(c.depth ?? 0) * 16 + 12}px` }}
                onClick={() => openChapter(c.id)}
              >
                <span className="chapter-index">
                  {String(c.order_index).padStart(2, "0")}
                </span>
                <span>{c.title}</span>
                {activeChapter?.id === c.id && (
                  <span className="chapter-done">{t.reader.readingNow}</span>
                )}
              </button>
            );

            return (
              <>
                {sliceRange && (
                  <div className="slice-label">
                    {t.reader.sliceLabel(sliceRange.start, sliceRange.end)}
                  </div>
                )}
                {inSlice.map((c) => renderChapter(c, !!sliceRange))}
                {doneOthers.length > 0 && (
                  <>
                    <div className="slice-label">{t.reader.completedSection}</div>
                    {doneOthers.map((c) => renderChapter(c, false))}
                  </>
                )}
                {others.length > 0 && sliceRange && (
                  <>
                    <button
                      className="chapter-toggle"
                      onClick={() => setShowAllChapters((v) => !v)}
                    >
                      {showAllChapters
                        ? t.reader.collapseOthers
                        : t.reader.expandAllChapters(chapters.length)}
                    </button>
                    {showAllChapters && rest.map((c) => renderChapter(c, false))}
                  </>
                )}
              </>
            );
          })()}
        </nav>
      </aside>

      <main className="reader-main">
        <div className="reader-toolbar">
          <span className="reader-bar-label">
            {activeChapter ? t.reader.chapterLabel(activeChapter.order_index) : t.reader.bodyLabel}
          </span>
          <span className="reader-bar-grow" />
          <button
            className="reader-mini reader-mini-icon"
            aria-label={t.reader.listen}
            title={t.reader.listen}
            onClick={() => {
              setAudioSignal((v) => v + 1);
              document
                .getElementById("reader-audio")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Icon name="head" />
          </button>
          {!isChinese &&
            (Object.keys(translations).length > 0 ? (
              <button
                className="reader-mini"
                onClick={() => setShowTranslation(!showTranslation)}
              >
                {showTranslation ? t.reader.original : t.reader.translate}
              </button>
            ) : (
              <button
                className="reader-mini"
                disabled={translating}
                style={{ opacity: translating ? 0.5 : 1 }}
                title={t.reader.translateTitle}
                onClick={() => {
                  const ids = paragraphs
                    .filter((p) => !p.image_path)
                    .map((p) => p.id);
                  if (ids.length > 0) translateParagraphs(ids);
                }}
              >
                {translating ? t.reader.translating : t.reader.translate}
              </button>
            ))}
          <button
            className="reader-mini reader-mini-icon"
            aria-label={t.reader.settings}
            title={t.reader.settings}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <Icon name="gear" />
          </button>

          {settingsOpen && (
            <>
              <div
                className="reader-settings-backdrop"
                onClick={() => setSettingsOpen(false)}
              />
              <div className="reader-settings">
                <div className="reader-settings-row">
                  <span className="reader-settings-label">{t.reader.fontSizeLabel}</span>
                  <div className="reader-settings-group">
                    <button
                      onClick={() => changeFontSize(-1)}
                      aria-label={t.reader.fontSizeDown}
                    >
                      A-
                    </button>
                    <span className="reader-settings-hint">{fontSize}px</span>
                    <button
                      onClick={() => changeFontSize(1)}
                      aria-label={t.reader.fontSizeUp}
                    >
                      A+
                    </button>
                  </div>
                </div>
                <div className="reader-settings-row">
                  <span className="reader-settings-label">{t.reader.themeLabel}</span>
                  <div className="reader-settings-group">
                    <button
                      className={themePref === "light" ? "active" : ""}
                      onClick={() => applyTheme("light")}
                    >
                      {t.reader.themeLight}
                    </button>
                    <button
                      className={themePref === "dark" ? "active" : ""}
                      onClick={() => applyTheme("dark")}
                    >
                      {t.reader.themeDark}
                    </button>
                    <button
                      className={themePref === "system" ? "active" : ""}
                      onClick={() => applyTheme("system")}
                    >
                      {t.reader.themeSystem}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {sidebarOpen && (
          <div
            className="reader-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div
          className="reader-content"
          style={{ "--reader-font-size": `${fontSize}px` } as React.CSSProperties}
        >
          {activeChapter ? (
            <>
              <h1 className="reader-chapter-title">{activeChapter.title}</h1>
              <div className="reader-hint">
                {t.reader.paragraphsHint(paragraphs.length)}
                {!isChinese && Object.keys(translations).length > 0 && (
                  <span className="machine-tag">{t.reader.machineTag}</span>
                )}
              </div>

              {!isChinese && !translating && translateError && (
                <div className="reader-hint" role="status">
                  {translateError}
                </div>
              )}

              {loading ? (
                <>
                  <p className="reader-hint">{t.reader.loading}</p>
                  {slowLoad && (
                    <p className="reader-hint">{t.reader.slowLoad}</p>
                  )}
                </>
              ) : (
                paragraphs.map((p) => {
                  if (p.image_path) {
                    const src = imageUrls[p.image_path];
                    if (!src) return null;
                    return (
                      <figure key={p.id} className="reader-figure">
                        <img src={src} alt="" loading="lazy" />
                      </figure>
                    );
                  }

                  const bt = p.block_type || "p";
                  if (bt === "hr") {
                    return <hr key={p.id} className="reader-hr" />;
                  }

                  const showT = !isChinese && showTranslation;
                  const note = annotations[p.id];
                  const isSelected = selected === p.id;

                  // 原文模式用 text_html（白名单清洗过的内联 HTML），译文/pre 用纯文本
                  let inner: React.ReactNode;
                  if (showT || !p.text_html) {
                    const text =
                      showT && translations[p.id]
                        ? translations[p.id]
                        : p.text_original;
                    inner = text;
                  } else {
                    inner = (
                      <span dangerouslySetInnerHTML={{ __html: p.text_html }} />
                    );
                  }

                  let Tag: any = "p";
                  if (bt === "li") Tag = "div";
                  else if (/^h[1-6]$/.test(bt)) Tag = bt;
                  else if (bt === "blockquote") Tag = "blockquote";
                  else if (bt === "pre") Tag = "pre";
                  else Tag = "p";

                  return (
                    <Fragment key={p.id}>
                      <Tag
                        id={`para-${p.id}`}
                        className={`reader-block reader-${bt} ${
                          isSelected ? "selected" : ""
                        }`}
                        style={{
                          borderLeft: note
                            ? `4px solid ${COLOR_HEX[note.color]}`
                            : undefined,
                        }}
                        onClick={() => setSelected(isSelected ? null : p.id)}
                      >
                        {inner}
                      </Tag>
                      {note?.comment && (
                        <div
                          className="note-comment"
                          style={{ color: COLOR_HEX[note.color] }}
                        >
                          📝 {note.comment}
                        </div>
                      )}
                      {isSelected && (
                        <div className="note-panel">
                          <div className="note-panel-title">
                            {t.reader.notePanelTitle(
                              paragraphs.findIndex((x) => x.id === selected) + 1,
                            )}
                          </div>
                          <textarea
                            value={noteComment}
                            onChange={(e) => setNoteComment(e.target.value)}
                            placeholder={t.reader.notePlaceholder}
                          />
                          <div className="note-panel-row">
                            <div className="note-colors">
                              {["yellow", "blue", "green"].map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  className={`color-dot ${
                                    noteColor === c ? "active" : ""
                                  }`}
                                  style={{ background: COLOR_HEX[c] }}
                                  onClick={() => setNoteColor(c)}
                                />
                              ))}
                            </div>
                            <button onClick={saveNote}>{t.reader.saveNote}</button>
                            {noteMessage && (
                              <span className="note-message">{noteMessage}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </Fragment>
                  );
                })
              )}

              {offline && (
                <div className="reader-hint" style={{ color: "#b45309" }}>
                  {t.reader.offlineHint}
                </div>
              )}

              <div className="reader-foot">
                <div className="reader-actions">
                  <div id="reader-audio" className="reader-audio-anchor">
                  <AudioReader
                    openSignal={audioSignal}
                    chapterTitle={activeChapter.title}
                    segments={paragraphs
                      .filter(
                        (p) =>
                          !p.image_path &&
                          (p.block_type || "p") !== "hr" &&
                          (p.text_original ?? "").trim().length > 0,
                      )
                      .map((p) => ({ id: p.id, text: p.text_original }))}
                  />
                  </div>
                  <button
                    onClick={completeChapter}
                    disabled={completing || chapterCompleted}
                  >
                    {chapterCompleted
                      ? t.reader.chapterDone
                      : completing
                        ? t.reader.submitting
                        : t.reader.completeChapter}
                  </button>
                  <button
                    className="reader-nav-btn btn-ghost btn-sm icon-only"
                    aria-label={t.reader.prevChapter}
                    title={t.reader.prevChapter}
                    disabled={!hasPrevChapter}
                    onClick={() => goAdjacentChapter(-1)}
                  >
                    <Icon name="back" />
                  </button>
                  <button
                    className="reader-nav-btn btn-ghost btn-sm icon-only"
                    aria-label={t.reader.nextChapter}
                    title={t.reader.nextChapter}
                    disabled={!hasNextChapter}
                    onClick={() => goAdjacentChapter(1)}
                  >
                    <Icon name="next" />
                  </button>
                  <button
                    className="btn-ghost btn-sm icon-only"
                    aria-label={t.reader.contents}
                    title={t.reader.contents}
                    onClick={() => {
                      setShowAllChapters(true);
                      setSidebarOpen(true);
                    }}
                  >
                    <Icon name="toc" />
                  </button>
                </div>
                {(completeMessage || chapterCompleted) && (
                  <p className="note-message" style={{ margin: "8px 0 0" }}>
                    {completeMessage || t.reader.completedFallback}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="reader-empty">
              {notFound ? t.reader.notFound : t.reader.empty}
            </div>
          )}
        </div>
      </main>

      <Guide
        userId={userId}
        hints={
          activeChapter
            ? [
                {
                  id: "complete-chapter",
                  text: t.reader.completeGuide,
                },
              ]
            : []
        }
      />
    </div>
  );
}
