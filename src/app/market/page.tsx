"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { copy } from "@/lib/copy";

type Book = { title: string; author: string; reason: string };
type Template = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  daily_budget_minutes: number;
  books: Book[];
  generated?: boolean;
};

export default function MarketPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [message, setMessage] = useState("");
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [randomTemplate, setRandomTemplate] = useState<Template | null>(null);
  const [generatingRandom, setGeneratingRandom] = useState(false);

  useEffect(() => {
    fetch("/api/market")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setMessage(json.error);
        else setTemplates(json.templates ?? []);
      })
      .catch(() => setMessage(copy.market.loadFailed));
  }, []);

  async function useTemplate(t: Template) {
    setCloningId(t.id);
    setMessage("");
    const res = await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        t.generated ? { template: t } : { template_id: t.id },
      ),
    });
    const json = await res.json().catch(() => ({}));
    setCloningId(null);
    if (res.ok) {
      if (t.generated) setRandomTemplate(null);
      setMessage(copy.market.applied(t.name));
    } else {
      setMessage(copy.market.applyFailed(json.error ?? res.status));
    }
  }

  async function generateRandom() {
    setGeneratingRandom(true);
    setMessage("");
    const res = await fetch("/api/market/random", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setGeneratingRandom(false);
    if (res.ok && json.template) {
      setRandomTemplate(json.template);
    } else {
      setMessage(copy.market.randomFailed(json.error ?? res.status));
    }
  }

  return (
    <>
      <AppNav />
      <div className="container app-main">
        <div className="page-head page-head-row">
          <div>
            <span className="kicker">Market</span>
            <h1>阅读路径灵感集</h1>
            <p className="sub">{copy.market.intro}</p>
          </div>
          <button
            className="btn-line btn-sm"
            onClick={generateRandom}
            disabled={generatingRandom}
          >
            {generatingRandom ? "AI 生成中…" : "随机生成一份"}
          </button>
        </div>

        {message && (
          <p className={`message ${message.startsWith("已") ? "ok" : "err"}`}>
            {message}
          </p>
        )}

        {randomTemplate && (
          <section className="theme-card" style={{ marginBottom: 26 }}>
            <div className="theme-head">
              <div style={{ minWidth: 0 }}>
                <span className="kicker">AI 随机生成</span>
                <h1 style={{ marginTop: 6 }}>{randomTemplate.name}</h1>
                <p className="sub" style={{ margin: "6px 0 0" }}>
                  {randomTemplate.tagline || randomTemplate.description}
                </p>
              </div>
              <div className="acts">
                <button
                  className="btn-sm"
                  onClick={() => useTemplate(randomTemplate)}
                  disabled={cloningId === randomTemplate.id}
                >
                  {cloningId === randomTemplate.id ? "使用中…" : "使用此清单"}
                </button>
                <button
                  className="btn-ghost btn-sm"
                  onClick={generateRandom}
                  disabled={generatingRandom}
                >
                  {generatingRandom ? "生成中…" : "换一份"}
                </button>
              </div>
            </div>

            <div className="theme-stats">
              <div className="stat">
                <div className="k">书目</div>
                <div className="v">{randomTemplate.books.length} 本</div>
              </div>
              <div className="stat">
                <div className="k">每日预算</div>
                <div className="v">
                  {randomTemplate.daily_budget_minutes} 分钟
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              {randomTemplate.books.map((b, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 12,
                      color: "#9ca3af",
                      minWidth: 22,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: 14.5,
                        fontWeight: 600,
                      }}
                    >
                      {b.title}
                      {b.author && (
                        <span
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 11.5,
                            fontWeight: 400,
                            color: "#9ca3af",
                            marginLeft: 8,
                          }}
                        >
                          {b.author}
                        </span>
                      )}
                    </div>
                    {b.reason && (
                      <p
                        className="muted"
                        style={{ margin: "4px 0 0", fontSize: 11.5 }}
                      >
                        {b.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <p className="muted" style={{ margin: "12px 0 0" }}>
                使用后可在「主题与清单」里微调顺序与预算。
              </p>
            </div>
          </section>
        )}

        {templates.length === 0 ? (
          <p className="muted">加载中…</p>
        ) : (
          <div className="market-cards" style={{ marginTop: 8 }}>
            {templates.map((t) => (
              <div className="listcard" key={t.id}>
                <div className="top">
                  <h2 className="n">{t.name}</h2>
                  <span className="chip">{t.books.length} 本</span>
                </div>
                <p className="d">{t.tagline || t.description}</p>
                <details className="plain">
                  <summary>展开书目</summary>
                  <ol>
                    {t.books.map((b, i) => (
                      <li key={i}>
                        {b.title}
                        {b.author ? ` · ${b.author}` : ""}
                      </li>
                    ))}
                  </ol>
                </details>
                <div className="foot">
                  <span className="chip">每天 {t.daily_budget_minutes} 分钟</span>
                  <button
                    className="btn-line btn-sm"
                    style={{ marginLeft: "auto" }}
                    onClick={() => useTemplate(t)}
                    disabled={cloningId === t.id}
                  >
                    {cloningId === t.id ? "使用中…" : "使用此清单"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="muted" style={{ margin: "30px 0 0" }}>
          这些书单里的书默认是「待补充」状态，去「主题与清单」点「刷新」会自动匹配库内已有的书。{" "}
          <Link href="/themes">去我的主题与清单 →</Link>
        </p>
      </div>
    </>
  );
}
