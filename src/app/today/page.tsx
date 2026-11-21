"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppNav from "@/components/AppNav";
import DailyPackCard from "@/components/DailyPackCard";
import { copy } from "@/lib/copy";

type Stats = {
  books: { completed_books: number; completed_chapters: number };
  words: { original: number; translated_estimate: number };
};

export default function TodayPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [readingSpeed, setReadingSpeed] = useState("300");
  const [speedMessage, setSpeedMessage] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

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
      setSpeedMessage({ text: copy.today.speedInvalid, ok: false });
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
      setSpeedMessage({ text: copy.today.speedSaved, ok: true });
    } else {
      setSpeedMessage({
        text: copy.today.speedSaveFailed(json.error ?? res.status),
        ok: false,
      });
    }
  }

  const speedForm = (
    <div className="side-block">
      <span className="kicker">阅读偏好</span>
      <div className="field">
        <input
          type="number"
          value={readingSpeed}
          onChange={(e) => setReadingSpeed(e.target.value)}
          min={100}
          max={1000}
        />
        <span>字 / 分钟</span>
      </div>
      <button
        className="btn-line btn-sm speed-save"
        onClick={saveReadingSpeed}
      >
        保存
      </button>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: 11.5 }}>
        {copy.today.speedHelp}
      </p>
      {speedMessage && (
        <p
          className={`message ${speedMessage.ok ? "ok" : "err"}`}
          style={{ marginTop: 8, marginBottom: 0 }}
        >
          {speedMessage.text}
        </p>
      )}
    </div>
  );

  return (
    <>
      <AppNav />
      <div className="container app-main">
        <div className="today-grid">
          <div className="today-main">
            <DailyPackCard />

            <Link href="/stats" className="today-stats-link">
              <div className="strip-head">
                <span className="kicker">累计阅读</span>
                <span className="more">详细统计 →</span>
              </div>
              <div className="stat-strip">
                <div className="cell">
                  <div className="k">读完整本</div>
                  <div className="v">
                    {stats?.books.completed_books ?? "—"}
                    <small>本</small>
                  </div>
                </div>
                <div className="cell">
                  <div className="k">完成章节</div>
                  <div className="v">
                    {stats?.books.completed_chapters ?? "—"}
                    <small>章</small>
                  </div>
                </div>
                <div className="cell">
                  <div className="k">完成字数</div>
                  <div className="v">
                    {stats
                      ? stats.words.original >= 10000
                        ? (stats.words.original / 10000).toFixed(1)
                        : stats.words.original.toLocaleString("zh-CN")
                      : "—"}
                    <small>
                      {stats && stats.words.original >= 10000 ? "万字" : "字"}
                    </small>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          <aside className="today-aside">
            {speedForm}
            <div className="side-block">
              <span className="kicker">快捷</span>
              <div className="side-row">
                <Link href="/library">我的书库</Link>
                <span className="arrow">→</span>
              </div>
              <div className="side-row">
                <Link href="/notes">全部笔记</Link>
                <span className="arrow">→</span>
              </div>
              <div className="side-row">
                <Link href="/themes">主题与清单</Link>
                <span className="arrow">→</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
