"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppNav from "@/components/AppNav";
import { copy } from "@/lib/copy";

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

// 我的书库：所有登录用户共用同一套界面（上传 + 书库列表）。
// v2 私有书库：每位用户只看到、只能操作自己的书。
export default function LibraryPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [pendingBooks, setPendingBooks] = useState<PendingBook[]>([]);
  // 首屏数据到齐前不渲染空状态，避免“先空后满”的闪烁
  const [loaded, setLoaded] = useState(false);
  // 两个列表默认只展示前 10 本，其余折叠
  const [showAllPending, setShowAllPending] = useState(false);
  const [showAllDocs, setShowAllDocs] = useState(false);
  const LIST_LIMIT = 10;
  const pendingShown = showAllPending
    ? pendingBooks
    : pendingBooks.slice(0, LIST_LIMIT);
  const docsShown = showAllDocs ? documents : documents.slice(0, LIST_LIMIT);

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
      return;
    }
    const res = await fetch("/api/storage/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    const json = await res.json().catch(() => ({}));
    setCoverUrls(json.urls ?? {});
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        setLoaded(true);
        return;
      }
      setUserId(u.id);
      Promise.all([loadDocuments(u.id), loadPending()])
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
      setMessage({ text: copy.library.pickFile, ok: false });
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
        setMessage({
          text: copy.library.duplicate(json.document?.title),
          ok: true,
        });
      } else {
        setMessage({
          text: copy.library.uploadSuccess(
            json.document?.title,
            json.chapter_count ?? "?",
            json.paragraph_count ?? "?",
          ),
          ok: true,
        });
      }
      form.reset();
      setSelectedFile(null);
      if (userId) {
        loadDocuments(userId);
        loadPending();
      }
    } else {
      setMessage({ text: copy.library.uploadFailed(json.error ?? res.status), ok: false });
    }
  }

  async function handleDelete(docId: string) {
    if (!window.confirm(copy.library.deleteConfirm)) return;
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    if (res.ok) {
      if (userId) {
        loadDocuments(userId);
        loadPending();
      }
    } else {
      const json = await res.json().catch(() => ({}));
      setMessage({ text: copy.library.deleteFailed(json.error ?? res.status), ok: false });
    }
  }

  const totalWords = documents.reduce(
    (sum, doc) => sum + (doc.total_words_original || 0),
    0,
  );

  return (
    <>
      <AppNav />
      <div className="container app-main">
        <div className="page-head">
          <span className="kicker">Library</span>
          <h1>我的书库</h1>
        </div>

        <div className="stat-strip">
          <div className="cell">
            <div className="k">已上传</div>
            <div className="v">
              {documents.length}
              <small>本</small>
            </div>
          </div>
          <div className="cell">
            <div className="k">待补充</div>
            <div className="v">
              {pendingBooks.length}
              <small>本</small>
            </div>
          </div>
          <div className="cell">
            <div className="k">累计字数</div>
            <div className="v">
              {totalWords >= 10000
                ? (totalWords / 10000).toFixed(1)
                : totalWords}
              <small>{totalWords >= 10000 ? "万字" : "字"}</small>
            </div>
          </div>
        </div>
        <p className="stat-note">
          书库只保存你上传的 EPUB；主题清单里缺失的书会列在下方「待补充」。
        </p>

        <form onSubmit={handleUpload} className="drop lib-upload">
          <div className="ico">EPUB</div>
          <div className="txt">
            <p>{uploading ? "上传解析中…" : "上传一本 EPUB"}</p>
            <small>
              单本 ≤ 50MB · 目前仅支持 .epub；PDF / MOBI / AZW3 / TXT
              等格式请先自行转换为 EPUB 再上传。
            </small>
            {selectedFile && (
              <small className="picked">
                已选择：{selectedFile.name}（
                {selectedFile.size >= 1024 * 1024
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`
                  : `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`}
                ）
              </small>
            )}
            <small>
              仅上传你有权使用的文件；非中文材料在阅读时会发送给第三方 AI
              服务（DeepSeek）进行机器翻译。
            </small>
            {message && (
              <p
                className={`message ${message.ok ? "ok" : "err"}`}
                style={{ margin: "10px 0 0" }}
              >
                {message.text}
              </p>
            )}
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
            {selectedFile ? "重新选择" : "选择文件"}
          </label>
          <button type="submit" disabled={uploading}>
            {uploading ? "解析中…" : "上传"}
          </button>
        </form>

        {!loaded && <div className="page-loading">正在读取书库…</div>}
        <div
          className={`lib-cols${pendingBooks.length > 0 ? " two" : ""}`}
          style={{ display: loaded ? undefined : "none" }}
        >
        {pendingBooks.length > 0 && (
          <section className="lib-section lib-pending">
            <div className="card-head">
              <span className="kicker">待补充 · {pendingBooks.length}</span>
            </div>
            <p className="sub" style={{ margin: "0 0 10px" }}>
              {copy.library.pendingHelp}
            </p>
            <div className={`lib-sheet${showAllPending ? " scroll" : ""}`}>
            {pendingShown.map((b) => (
              <div className="book-row" key={`${b.title}|${b.author}`}>
                <div className="cover pending">待补</div>
                <div className="m">
                  <div className="t">{b.title}</div>
                  <div className="s">
                    {b.author}
                    {b.themes.length > 0
                      ? ` · 来自主题：${b.themes.join("、")}`
                      : ""}
                  </div>
                </div>
              </div>
            ))}
            </div>
            {pendingBooks.length > LIST_LIMIT && (
              <button
                type="button"
                className="lib-more"
                onClick={() => setShowAllPending((v) => !v)}
              >
                {showAllPending
                  ? "收起"
                  : `展开全部 ${pendingBooks.length} 本`}
              </button>
            )}
          </section>
        )}

        <section className="lib-section">
          <div className="card-head">
            <span className="kicker">书库 · {documents.length}</span>
          </div>
          <p className="sub" style={{ margin: "0 0 10px" }}>
            {copy.library.uploadedHelp}
          </p>
          {!loaded ? null : documents.length === 0 ? (
            <div className="lib-empty">
              <h2>先上传一本 EPUB</h2>
              <p>{copy.library.empty}</p>
              <Link href="/themes" className="btn-line btn-sm">
                {copy.library.emptyLink}
              </Link>
            </div>
          ) : (
            <>
            <div className={`lib-sheet${showAllDocs ? " scroll" : ""}`}>
            {docsShown.map((d) => (
              <div className="book-row" key={d.id}>
                <Link
                  href={`/books/${d.id}`}
                  className="cover"
                  style={{ lineHeight: 0 }}
                >
                  {d.cover_url && coverUrls[d.cover_url] ? (
                    <img
                      src={coverUrls[d.cover_url]}
                      alt={d.title}
                      loading="lazy"
                    />
                  ) : (
                    d.title.slice(0, 1)
                  )}
                </Link>
                <div className="m">
                  <Link href={`/books/${d.id}`} className="t">
                    {d.title}
                  </Link>
                  <div className="s">
                    {d.author || "未知作者"} · {d.language || "未知语言"} ·{" "}
                    {(d.total_words_original ?? 0).toLocaleString("zh-CN")}{" "}
                    字/词
                  </div>
                </div>
                <button
                  className="btn-danger btn-xs"
                  onClick={() => handleDelete(d.id)}
                >
                  删除
                </button>
              </div>
            ))}
            </div>
            {documents.length > LIST_LIMIT && (
              <button
                type="button"
                className="lib-more"
                onClick={() => setShowAllDocs((v) => !v)}
              >
                {showAllDocs ? "收起" : `展开全部 ${documents.length} 本`}
              </button>
            )}
            </>
          )}
        </section>
        </div>
      </div>
    </>
  );
}
