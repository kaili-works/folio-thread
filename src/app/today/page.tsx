"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppNav from "@/components/AppNav";
import DailyPackCard from "@/components/DailyPackCard";
import { useT } from "@/i18n";

type Stats = {
  books: { completed_books: number; completed_chapters: number };
  words: { original: number; translated_estimate: number };
};

// 提示只存类型和参数，切换语言后会按当前语言重新渲染
type SpeedMessage =
  | { kind: "saved" }
  | { kind: "invalid" }
  | { kind: "failed"; error: string | number };

export default function TodayPage() {
  const supabase = createClient();
  const t = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [readingSpeed, setReadingSpeed] = useState("300");
  const [speedMessage, setSpeedMessage] = useState<SpeedMessage | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("reading_speed")
        .eq("id", u.id)
        .single();
      if (typeof p?.reading_speed === "number") {
        setReadingSpeed(String(p.reading_speed));
      }
    });

    fetch("/api/stats")
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) setStats(json as Stats);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveReadingSpeed() {
    setSpeedMessage(null);
    const speed = Number(readingSpeed);
    if (!Number.isFinite(speed) || speed < 100 || speed > 1000) {
      setSpeedMessage({ kind: "invalid" });
      return;
    }
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_speed: Math.round(speed) }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setReadingSpeed(String(json.reading_speed));
      setSpeedMessage({ kind: "saved" });
    } else {
      setSpeedMessage({ kind: "failed", error: json.error ?? res.status });
    }
  }

  const speedText =
    speedMessage?.kind === "saved"
      ? t.today.speedSaved
      : speedMessage?.kind === "invalid"
        ? t.today.speedInvalid
        : speedMessage?.kind === "failed"
          ? t.today.speedSaveFailed(speedMessage.error)
          : null;

  function openPreferences() {
    const block = document.getElementById("reading-prefs");
    if (!block) return;
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.querySelector("input")?.focus({ preventScroll: true });
  }

  const words = stats ? t.today.words(stats.words.original) : null;

  return (
    <>
      <AppNav />
      <div className="container app-main">
        <div className="today-grid">
          <div className="today-main">
            <DailyPackCard onSettings={openPreferences} />

            <Link href="/stats" className="today-stats-link">
              <div className="strip-head">
                <span className="kicker">{t.today.statsKicker}</span>
                <span className="more">{t.today.statsMore} →</span>
              </div>
              <div className="stat-strip">
                <div className="cell">
                  <div className="k">{t.today.statBooks}</div>
                  <div className="v">
                    {stats?.books.completed_books ?? "—"}
                    {stats && <small>{t.today.unitBooks}</small>}
                  </div>
                </div>
                <div className="cell">
                  <div className="k">{t.today.statChapters}</div>
                  <div className="v">
                    {stats?.books.completed_chapters ?? "—"}
                    {stats && <small>{t.today.unitChapters}</small>}
                  </div>
                </div>
                <div className="cell">
                  <div className="k">{t.today.statWords}</div>
                  <div className="v">
                    {words?.value ?? "—"}
                    {words && <small>{words.unit}</small>}
                  </div>
                </div>
              </div>
            </Link>
          </div>

          <aside className="today-aside">
            <div className="side-block" id="reading-prefs">
              <span className="kicker">{t.today.prefsKicker}</span>
              <div className="field">
                <input
                  type="number"
                  value={readingSpeed}
                  onChange={(e) => setReadingSpeed(e.target.value)}
                  min={100}
                  max={1000}
                />
                <span>{t.today.prefsUnit}</span>
              </div>
              <button
                className="btn-line btn-sm speed-save"
                onClick={saveReadingSpeed}
              >
                {t.today.save}
              </button>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 11.5 }}>
                {t.today.speedHelp}
              </p>
              {speedText && (
                <p
                  className={`message ${speedMessage?.kind === "saved" ? "ok" : "err"}`}
                  style={{ marginTop: 8, marginBottom: 0 }}
                >
                  {speedText}
                </p>
              )}
            </div>
            <div className="side-block">
              <span className="kicker">{t.today.quickKicker}</span>
              <div className="side-row">
                <Link href="/library">{t.today.quickLibrary}</Link>
                <span className="arrow">→</span>
              </div>
              <div className="side-row">
                <Link href="/notes">{t.today.quickNotes}</Link>
                <span className="arrow">→</span>
              </div>
              <div className="side-row">
                <Link href="/themes">{t.today.quickThemes}</Link>
                <span className="arrow">→</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
