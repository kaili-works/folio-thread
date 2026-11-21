"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { copy } from "@/lib/copy";

const COLOR_HEX: Record<string, string> = {
  yellow: "#f59e0b",
  blue: "#3b82f6",
  green: "#10b981",
};

type Comment = {
  id: string;
  comment: string;
  color: string;
  time: string;
};

type ParaGroup = {
  paragraphId: string;
  order: number;
  excerpt: string;
  comments: Comment[];
};

type ChapterGroup = {
  chapterId: string;
  order: number;
  title: string;
  paragraphs: ParaGroup[];
};

export default function BookNotes() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [doc, setDoc] = useState<any>(null);
  const [groups, setGroups] = useState<ChapterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingColor, setEditingColor] = useState("yellow");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (docError) throw new Error(docError.message);
      setDoc(docData);
      if (!docData) {
        setGroups([]);
        setError("没有找到这本书，可能已被删除或无权访问。");
        return;
      }

      const { data: notes, error: notesError } = await supabase
        .from("annotations")
        .select("id, chapter_id, paragraph_id, comment, color, created_at")
        .eq("document_id", id)
        .order("created_at", { ascending: true });
      if (notesError) throw new Error(notesError.message);

      const { data: chapters, error: chaptersError } = await supabase
        .from("chapters")
        .select("id, title, order_index")
        .eq("document_id", id)
        .order("order_index");
      if (chaptersError) throw new Error(chaptersError.message);

      const paragraphIds = [...new Set((notes ?? []).map((n) => n.paragraph_id))];
      let paragraphs: { id: string; order_index: number; text_original: string }[] = [];
      if (paragraphIds.length) {
        const { data: paraData, error: paraError } = await supabase
          .from("paragraphs")
          .select("id, order_index, text_original")
          .in("id", paragraphIds);
        if (paraError) throw new Error(paraError.message);
        paragraphs = paraData ?? [];
      }

      const chapterMap = new Map((chapters ?? []).map((c) => [c.id, c]));
      const paraMap = new Map(paragraphs.map((p) => [p.id, p]));

      const grouped = new Map<string, ChapterGroup>();
      for (const n of notes ?? []) {
        const ch = chapterMap.get(n.chapter_id);
        if (!ch) continue;
        const para = paraMap.get(n.paragraph_id);
        const excerpt = (para?.text_original ?? "").slice(0, 10);

        if (!grouped.has(ch.id)) {
          grouped.set(ch.id, {
            chapterId: ch.id,
            order: ch.order_index,
            title: ch.title,
            paragraphs: [],
          });
        }
        const group = grouped.get(ch.id)!;

        let paraGroup = group.paragraphs.find(
          (p) => p.paragraphId === n.paragraph_id,
        );
        if (!paraGroup) {
          paraGroup = {
            paragraphId: n.paragraph_id,
            order: para?.order_index ?? 0,
            excerpt,
            comments: [],
          };
          group.paragraphs.push(paraGroup);
        }
        paraGroup.comments.push({
          id: n.id,
          comment: n.comment ?? "",
          color: n.color,
          time: n.created_at,
        });
      }

      const sorted = [...grouped.values()].sort((a, b) => a.order - b.order);
      for (const g of sorted) {
        g.paragraphs.sort((a, b) => a.order - b.order);
      }

      setGroups(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function deleteNote(annotationId: string) {
    if (!window.confirm("删除这条笔记？")) return;
    const res = await fetch(`/api/annotations/${annotationId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      load();
    } else {
      const json = await res.json().catch(() => ({}));
      alert("删除失败：" + (json.error ?? res.status));
    }
  }

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditingText(c.comment);
    setEditingColor(c.color);
  }

  async function saveEdit() {
    if (!editingId) return;
    const res = await fetch(`/api/annotations/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: editingText, color: editingColor }),
    });
    if (res.ok) {
      setEditingId(null);
      load();
    } else {
      const json = await res.json().catch(() => ({}));
      alert("保存失败：" + (json.error ?? res.status));
    }
  }

  function escapeMarkdown(s: string): string {
    return s.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
  }

  function exportMarkdown() {
    const lines: string[] = [];
    lines.push(`# 《${doc?.title ?? ""}》读书笔记`);
    lines.push("");
    for (const g of groups) {
      lines.push(`## ${escapeMarkdown(g.title)}`);
      lines.push("");
      for (const p of g.paragraphs) {
        lines.push(
          `### 第 ${p.order} 段 · "${escapeMarkdown(p.excerpt)}${p.excerpt ? "…" : ""}"`,
        );
        lines.push("");
        for (const c of p.comments) {
          const body = c.comment ? escapeMarkdown(c.comment) : "（无评论，仅标记）";
          lines.push(`- ${body}  \`${new Date(c.time).toLocaleString()}\``);
        }
        lines.push("");
      }
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc?.title ?? "笔记"}-笔记.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container">
      <Link
        href={`/books/${id}`}
        className="reader-back"
        style={{ marginBottom: 18 }}
      >
        ← 返回阅读
      </Link>

      <div className="page-head page-head-row">
        <div>
          <span className="kicker">Notes</span>
          <h1>{doc?.title ?? (loading ? "加载中…" : "读书笔记")}</h1>
        </div>
        {!loading && groups.length > 0 && (
          <button className="btn-ghost btn-sm" onClick={exportMarkdown}>
            导出 Markdown
          </button>
        )}
      </div>

      {loading ? (
        <p className="muted">加载中…</p>
      ) : error ? (
        <div>
          <p className="muted">{error}</p>
          <button className="btn-ghost btn-sm" onClick={load}>
            重试
          </button>
        </div>
      ) : groups.length === 0 ? (
        <p className="muted">{copy.stats.noNotes}</p>
      ) : (
        groups.map((g, gi) => (
          <section
            key={g.chapterId}
            style={{
              paddingTop: gi === 0 ? 0 : 28,
              marginTop: gi === 0 ? 0 : 28,
              borderTop: gi === 0 ? "none" : "1px solid #e5e7eb",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 18,
                fontWeight: 600,
                margin: "0 0 12px",
              }}
            >
              {g.title}
            </h2>
            {g.paragraphs.map((p, pi) => (
              <div
                key={p.paragraphId}
                style={{
                  padding: "12px 0",
                  borderTop: pi === 0 ? "none" : "1px solid #f0f0f0",
                }}
              >
                <Link
                  href={`/books/${id}?chapter=${g.chapterId}&paragraph=${p.paragraphId}`}
                  style={{
                    fontSize: 12.5,
                    color: "#6b7280",
                    textDecoration: "none",
                  }}
                >
                  第 {p.order} 段 · “{p.excerpt}
                  {p.excerpt ? "…" : ""}”
                </Link>
                <div style={{ marginTop: 8 }}>
                  {p.comments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        fontSize: 13,
                        color: "#374151",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        lineHeight: 1.7,
                      }}
                    >
                      {editingId === c.id ? (
                        <div style={{ flex: 1 }}>
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            style={{
                              width: "100%",
                              minHeight: 56,
                              padding: 8,
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                              fontSize: 13.5,
                              fontFamily: "inherit",
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              marginTop: 6,
                            }}
                          >
                            {["yellow", "blue", "green"].map((col) => (
                              <button
                                key={col}
                                type="button"
                                onClick={() => setEditingColor(col)}
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: "50%",
                                  background: COLOR_HEX[col],
                                  border:
                                    editingColor === col
                                      ? "2px solid #111827"
                                      : "2px solid transparent",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              />
                            ))}
                            <button
                              className="btn-sm"
                              onClick={saveEdit}
                            >
                              保存
                            </button>
                            <button
                              className="btn-ghost btn-sm"
                              onClick={() => setEditingId(null)}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: COLOR_HEX[c.color] ?? "#9ca3af",
                              flex: "0 0 auto",
                              marginTop: 8,
                            }}
                          />
                          <span style={{ flex: 1 }}>
                            {c.comment || "（无评论，仅标记）"}
                            <span className="muted" style={{ fontSize: 11 }}>
                              {" "}
                              · {new Date(c.time).toLocaleString("zh-CN")}
                            </span>
                          </span>
                          <button
                            className="btn-quiet btn-xs"
                            onClick={() => startEdit(c)}
                          >
                            编辑
                          </button>
                          <button
                            className="btn-danger btn-xs"
                            onClick={() => deleteNote(c.id)}
                          >
                            删除
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
