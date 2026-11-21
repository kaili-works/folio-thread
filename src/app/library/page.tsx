"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppNav from "@/components/AppNav";
import { Icon } from "@/components/Icon";
import { useT } from "@/i18n";

type Doc = {
  id: string;
  title: string;
  author: string;
  language: string;
  total_words_original: number;
  cover_url: string | null;
};

type PendingBook = {
  title: string;
  author: string;
  themes: string[];
  reason: string;
};

// 提示只存类型与参数，切换语言后会按当前语言重新渲染
type Message =
  | { kind: "pickFile" }
  | { kind: "duplicate"; title: string }
  | {
      kind: "uploaded";
      title: string;
      chapters: number | string;
      paragraphs: number | string;
    }
  | { kind: "uploadFailed"; error: string | number }
  | { kind: "deleteFailed"; error: string | number };

// 我的书库：所有登录用户共用同一套界面（上传 + 书库列表）。
// v2 私有书库：每位用户只看到、只能操作自己的书。
export default function LibraryPage() {
  const supabase = createClient();
  const t = useT();
  const [userId, setUserId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [pendingBooks, setPendingBooks] = useState<PendingBook[]>([]);
  // 首屏数据到齐前不渲染空状态，避免“先空后满”的闪烁
  const [loaded, setLoaded] = useState(false);
  // 上传面板与搜索默认收起，由页头图标唤起
  const [showUpload, setShowUpload] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // 两个列表默认只展示前 10 本，其余折叠
  const [showAllPending, setShowAllPending] = useState(false);
  const [showAllDocs, setShowAllDocs] = useState(false);
  const LIST_LIMIT = 10;

  const q = query.trim().toLowerCase();
  const docsFiltered = q
    ? documents.filter((d) =>
        `${d.title} ${d.author}`.toLowerCase().includes(q),
      )
    : documents;
  const pendingFiltered = q
    ? pendingBooks.filter((b) =>
        `${b.title} ${b.author} ${b.themes.join(" ")}`
          .toLowerCase()
          .includes(q),
      )
    : pendingBooks;
  const docsShown = showAllDocs ? docsFiltered : docsFiltered.slice(0, LIST_LIMIT);
  const pendingShown = showAllPending
    ? pendingFiltered
    : pendingFiltered.slice(0, LIST_LIMIT);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // 待补充清单：清单里存在、但书库还没有的书
  async function loadPending() {
    const res = await fetch("/api/library/pending");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setPendingBooks(json.pending ?? []);
  }

  async function loadDocuments(uid: string) {
    const { data } = await supabase
      .from("documents")
      .select("id, title, author, language, total_words_original, cover_url")
      .eq("owner_id", uid)
      .order("created_at", { ascending: false });
    const list = (data as Doc[]) ?? [];
    setDocuments(list);

    // 封面存于私有 bucket：一次性批量签名，避免逐本请求
    const paths = list
      .map((d) => d.cover_url)
      .filter((p): p is string => !!p);
    if (paths.length === 0) {
      setCoverUrls({});
      return list;
    }
    const res = await fetch("/api/storage/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    const json = await res.json().catch(() => ({}));
    setCoverUrls(json.urls ?? {});
    return list;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        setShowUpload(true);
        setLoaded(true);
        return;
      }
      setUserId(u.id);
      Promise.all([loadDocuments(u.id), loadPending()])
        .then(([list]) => {
          // 空书库时直接把上传面板展开，省一次点击
          if (!list || list.length === 0) setShowUpload(true);
        })
        // 任一请求失败也要放开门控，否则页面会永久停在加载态
        .catch(() => {})
        .then(() => setLoaded(true));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) {
      setMessage({ kind: "pickFile" });
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok) {
      if (json.duplicate) {
        setMessage({ kind: "duplicate", title: json.document?.title ?? "" });
      } else {
        setMessage({
          kind: "uploaded",
          title: json.document?.title ?? "",
          chapters: json.chapter_count ?? "?",
          paragraphs: json.paragraph_count ?? "?",
        });
      }
      form.reset();
      setSelectedFile(null);
      if (userId) {
        loadDocuments(userId);
        loadPending();
      }
    } else {
      setMessage({ kind: "uploadFailed", error: json.error ?? res.status });
    }
  }

  async function handleDelete(docId: string) {
    if (!window.confirm(t.library.deleteConfirm)) return;
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    if (res.ok) {
      setMessage(null);
      if (userId) {
        loadDocuments(userId);
        loadPending();
      }
    } else {
      const json = await res.json().catch(() => ({}));
      setMessage({ kind: "deleteFailed", error: json.error ?? res.status });
    }
  }

  const totalWords = documents.reduce(
    (sum, doc) => sum + (doc.total_words_original || 0),
    0,
  );

  const messageText = !message
    ? null
    : message.kind === "pickFile"
      ? t.library.pickFile
      : message.kind === "duplicate"
        ? t.library.duplicate(message.title)
        : message.kind === "uploaded"
          ? t.library.uploadSuccess(
              message.title,
              message.chapters,
              message.paragraphs,
            )
          : message.kind === "uploadFailed"
            ? t.library.uploadFailed(message.error)
            : t.library.deleteFailed(message.error);
  const messageOk = message?.kind === "duplicate" || message?.kind === "uploaded";

  const fileSize = selectedFile
    ? selectedFile.size >= 1024 * 1024
      ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`
    : "";

  return (
    <>
      <AppNav />
      <div className="container app-main">
        <div className="page-head page-head-row lib-head">
          <div>
            <span className="kicker">{t.library.kicker}</span>
            <h1>{t.library.title}</h1>
            <p className="sub lib-meta">
              {t.library.shelfMeta(
                documents.length,
                pendingBooks.length,
                t.library.wordCount(totalWords),
              )}
            </p>
          </div>
          <div className="page-head-actions">
            <button
              className="icon-btn"
              onClick={() => {
                if (searchOpen) setQuery("");
                setSearchOpen((v) => !v);
              }}
              title={searchOpen ? t.library.closeSearch : t.library.search}
              aria-label={searchOpen ? t.library.closeSearch : t.library.search}
              aria-expanded={searchOpen}
            >
              <Icon name="search" />
            </button>
            <button
              className="icon-btn primary"
              onClick={() => setShowUpload((v) => !v)}
              title={t.library.upload}
              aria-label={t.library.upload}
              aria-expanded={showUpload}
            >
              <Icon name="upload" />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="lib-search">
            <Icon name="search" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.library.searchPlaceholder}
              aria-label={t.library.searchPlaceholder}
            />
          </div>
        )}

        {showUpload && (
          <form onSubmit={handleUpload} className="drop lib-upload">
            <div className="ico">EPUB</div>
            <div className="txt">
              <p>{uploading ? t.library.uploading : t.library.uploadTitle}</p>
              <small>{t.library.uploadLead}</small>
              {selectedFile && (
                <small className="picked">
                  {t.library.picked(selectedFile.name, fileSize)}
                </small>
              )}
              <small>{t.library.uploadPrivacy}</small>
            </div>
            <input
              type="file"
              name="file"
              id="epub-file"
              accept=".epub"
              required
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <label className="btn-line" htmlFor="epub-file">
              {selectedFile ? t.library.reselect : t.library.chooseFile}
            </label>
            <button type="submit" disabled={uploading}>
              {uploading ? t.library.submitting : t.library.submit}
            </button>
          </form>
        )}

        {messageText && (
          <p className={`message lib-message ${messageOk ? "ok" : "err"}`}>
            {messageText}
          </p>
        )}

        {!loaded && <div className="page-loading">{t.library.loading}</div>}

        <section className="lib-section lib-shelf">
          <div className="card-head">
            <span className="kicker">
              {t.library.shelfKicker} · {documents.length}
            </span>
          </div>
          {!loaded ? null : documents.length === 0 ? (
            <div className="lib-empty">
              <h2>{t.library.emptyTitle}</h2>
              <p>{t.library.empty}</p>
              <Link href="/themes" className="btn-line btn-sm">
                {t.library.emptyLink}
              </Link>
            </div>
          ) : docsFiltered.length === 0 ? (
            <p className="lib-noresult">{t.library.noResults}</p>
          ) : (
            <>
              <div className="lib-grid">
                {docsShown.map((d, i) => (
                  <article className="lib-card" key={d.id}>
                    <Link
                      href={`/books/${d.id}`}
                      className={`lib-cover c${(i % 5) + 1}`}
                      title={d.title}
                    >
                      {d.cover_url && coverUrls[d.cover_url] ? (
                        <img
                          src={coverUrls[d.cover_url]}
                          alt={d.title}
                          loading="lazy"
                        />
                      ) : (
                        <span>{d.title.trim().slice(0, 1) || "?"}</span>
                      )}
                    </Link>
                    <button
                      className="icon-btn lib-del"
                      onClick={() => handleDelete(d.id)}
                      title={t.library.delete}
                      aria-label={`${t.library.delete}：${d.title}`}
                    >
                      <Icon name="trash" />
                    </button>
                    <Link href={`/books/${d.id}`} className="t">
                      {d.title}
                    </Link>
                    <div className="a">{d.author || t.library.unknownAuthor}</div>
                  </article>
                ))}
              </div>
              {docsFiltered.length > LIST_LIMIT && (
                <button
                  type="button"
                  className="lib-more"
                  onClick={() => setShowAllDocs((v) => !v)}
                >
                  {showAllDocs
                    ? t.library.collapse
                    : t.library.expandAll(docsFiltered.length)}
                </button>
              )}
            </>
          )}
        </section>

        {pendingBooks.length > 0 && (
          <section className="lib-section lib-pending">
            <div className="card-head">
              <span className="kicker">
                {t.library.pendingKicker} · {pendingBooks.length}
              </span>
            </div>
            <p className="sub">{t.library.pendingHelp}</p>
            {pendingFiltered.length === 0 ? (
              <p className="lib-noresult">{t.library.noResults}</p>
            ) : (
              <>
                <div className={`lib-sheet${showAllPending ? " scroll" : ""}`}>
                  {pendingShown.map((b) => (
                    <div className="book-row" key={`${b.title}|${b.author}`}>
                      <div className="cover pending">
                        {t.library.pendingBadge}
                      </div>
                      <div className="m">
                        <div className="t">{b.title}</div>
                        <div className="s">
                          {b.author}
                          {b.themes.length > 0
                            ? ` · ${t.library.pendingFrom(b.themes)}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {pendingFiltered.length > LIST_LIMIT && (
                  <button
                    type="button"
                    className="lib-more"
                    onClick={() => setShowAllPending((v) => !v)}
                  >
                    {showAllPending
                      ? t.library.collapse
                      : t.library.expandAll(pendingFiltered.length)}
                  </button>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}
