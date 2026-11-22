"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { useI18n } from "@/i18n";

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
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [randomTemplate, setRandomTemplate] = useState<Template | null>(null);
  const [generatingRandom, setGeneratingRandom] = useState(false);

  useEffect(() => {
    fetch("/api/market")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setMessage({ text: json.error, ok: false });
        else setTemplates(json.templates ?? []);
      })
      .catch(() => setMessage({ text: t.market.loadFailed, ok: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function useTemplate(tpl: Template) {
    setCloningId(tpl.id);
    setMessage(null);
    const res = await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        tpl.generated ? { template: tpl } : { template_id: tpl.id },
      ),
    });
    const json = await res.json().catch(() => ({}));
    setCloningId(null);
    if (res.ok) {
      if (tpl.generated) setRandomTemplate(null);
      setMessage({ text: t.market.applied(tpl.name), ok: true });
    } else {
      setMessage({
        text: t.market.applyFailed(json.error ?? res.status),
        ok: false,
      });
    }
  }

  async function generateRandom() {
    setGeneratingRandom(true);
    setMessage(null);
    const res = await fetch("/api/market/random", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setGeneratingRandom(false);
    if (res.ok && json.template) {
      setRandomTemplate(json.template);
    } else {
      setMessage({
        text: t.market.randomFailed(json.error ?? res.status),
        ok: false,
      });
    }
  }

  return (
    <>
      <AppNav />
      <div className="container app-main">
        <div className="page-head page-head-row">
          <div>
            <span className="kicker">{t.market.kicker}</span>
            <h1>{t.market.title}</h1>
            <p className="sub">{t.market.intro}</p>
          </div>
          <button
            className="btn-line btn-sm"
            onClick={generateRandom}
            disabled={generatingRandom}
          >
            {generatingRandom ? t.market.generating : t.market.randomCta}
          </button>
        </div>

        {message && (
          <p className={`message ${message.ok ? "ok" : "err"}`}>
            {message.text}
          </p>
        )}

        {randomTemplate && (
          <section className="theme-card" style={{ marginBottom: 26 }}>
            <div className="theme-head">
              <div style={{ minWidth: 0 }}>
                <span className="kicker">{t.market.randomKicker}</span>
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
                  {cloningId === randomTemplate.id
                    ? t.market.using
                    : t.market.useList}
                </button>
                <button
                  className="btn-ghost btn-sm"
                  onClick={generateRandom}
                  disabled={generatingRandom}
                >
                  {generatingRandom ? t.market.regenerating : t.market.regenerate}
                </button>
              </div>
            </div>

            <div className="theme-stats">
              <div className="stat">
                <div className="k">{t.market.booksLabel}</div>
                <div className="v">
                  {t.market.booksCount(randomTemplate.books.length)}
                </div>
              </div>
              <div className="stat">
                <div className="k">{t.market.budgetLabel}</div>
                <div className="v">
                  {t.market.minutes(randomTemplate.daily_budget_minutes)}
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
                {t.market.afterUseTip}
              </p>
            </div>
          </section>
        )}

        {templates.length === 0 ? (
          <p className="muted">{t.market.loading}</p>
        ) : (
          <div className="market-cards" style={{ marginTop: 8 }}>
            {templates.map((tpl) => (
              <div className="listcard" key={tpl.id}>
                <div className="top">
                  <h2 className="n">{tpl.name}</h2>
                  <span className="chip">
                    {t.market.booksCount(tpl.books.length)}
                  </span>
                </div>
                <p className="d">{tpl.tagline || tpl.description}</p>
                <details className="plain">
                  <summary>{t.market.expand}</summary>
                  <ol>
                    {tpl.books.map((b, i) => (
                      <li key={i}>
                        {b.title}
                        {b.author ? ` · ${b.author}` : ""}
                      </li>
                    ))}
                  </ol>
                </details>
                <div className="foot">
                  <span className="chip">
                    {t.market.perDay(tpl.daily_budget_minutes)}
                  </span>
                  <button
                    className="btn-line btn-sm"
                    style={{ marginLeft: "auto" }}
                    onClick={() => useTemplate(tpl)}
                    disabled={cloningId === tpl.id}
                  >
                    {cloningId === tpl.id ? t.market.using : t.market.useList}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="muted" style={{ margin: "30px 0 0" }}>
          {t.market.pendingTip}{" "}
          <Link href="/themes">{t.market.goThemes}</Link>
        </p>
      </div>
    </>
  );
}
