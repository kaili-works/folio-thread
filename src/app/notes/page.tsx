"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  document_id: string;
  comment: string | null;
  created_at: string;
};

type Doc = { id: string; title: string; author: string | null };

export default function NotesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ doc: Doc; notes: Note[] }[]>([]);

  useEffect(() => {
    async function load() {
      const { data: notes } = await supabase
        .from("annotations")
        .select("id, document_id, comment, created_at")
        .not("comment", "is", null)
        .order("created_at", { ascending: false });

      const list = (notes ?? []) as Note[];
      const docIds = [...new Set(list.map((n) => n.document_id))];

      const { data: docs } = docIds.length
        ? await supabase
            .from("documents")
            .select("id, title, author")
            .in("id", docIds)
        : { data: [] };

      const docMap = new Map((docs ?? []).map((d) => [d.id, d as Doc]));
      const grouped: { doc: Doc; notes: Note[] }[] = [];
      for (const id of docIds) {
        const doc = docMap.get(id);
        if (!doc) continue;
        grouped.push({
          doc,
          notes: list.filter((n) => n.document_id === id),
        });
      }

      setGroups(grouped);
      setLoading(false);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = groups.reduce((sum, g) => sum + g.notes.length, 0);

  function escapeMarkdown(s: string): string {
    return s.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
  }

  function exportMarkdown() {
    const lines: string[] = ["# 我的笔记", ""];
    lines.push(`共 ${total} 条笔记，覆盖 ${groups.length} 本书`, "");
    for (const g of groups) {
      const author = g.doc.author ? ` · ${escapeMarkdown(g.doc.author)}` : "";
      lines.push(`## ${escapeMarkdown(g.doc.title)}${author}`, "");
      for (const n of g.notes) {
        const body = escapeMarkdown(n.comment ?? "");
        lines.push(`- ${body}  \`${new Date(n.created_at).toLocaleString()}\``);
      }
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "我的笔记.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AppNav />
      <div className="container app-main">
        <div className="page-head page-head-row">
          <div>
            <span className="kicker">Notes</span>
            <h1>我的笔记</h1>
            {!loading && total > 0 && (
              <p className="sub">
                共 {total} 条笔记，覆盖 {groups.length} 本书
              </p>
            )}
          </div>
          {!loading && total > 0 && (
            <button type="button" className="btn-ghost btn-sm" onClick={exportMarkdown}>
              导出 Markdown
            </button>
          )}
        </div>

        {loading && <p className="muted">加载中…</p>}

        {!loading && total === 0 && (
          <p className="muted">
            还没有笔记。阅读时选中正文即可添加批注，笔记会汇总到这里。
          </p>
        )}

        {groups.map((g) => (
          <section key={g.doc.id} className="note-group">
            <div className="note-group-head">
              <Link href={`/books/${g.doc.id}/notes`} className="note-book">
                {g.doc.title}
              </Link>
              <span className="note-count">{g.notes.length} 条</span>
            </div>
            {g.notes.map((n) => (
              <Link
                key={n.id}
                href={`/books/${g.doc.id}/notes`}
                className="note-row"
              >
                <span className="note-text">{n.comment}</span>
                <span className="note-time">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
