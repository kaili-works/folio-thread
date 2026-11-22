"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

// 顶栏「指南」：沿用登录页左侧的深绿品牌栏风格，分两页展示
export default function GuideModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [page, setPage] = useState<0 | 1>(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.guide.aria}
      className="onboarding-overlay"
      onClick={onClose}
    >
      <div className="guide-card" onClick={(e) => e.stopPropagation()}>
        <button
          className="guide-close"
          aria-label={t.guide.close}
          onClick={onClose}
        >
          ×
        </button>
        <aside className="auth-brand">
          <span className="kicker">{t.guide.kicker}</span>

          {page === 0 ? (
            <>
              <h1>{t.guide.startTitle}</h1>
              <p className="lead">{t.guide.startLead}</p>
              <ol className="auth-steps">
                {t.onboarding.steps.map((step, i) => (
                  <li key={step.title}>
                    <b>{i + 1}</b>
                    <span>
                      <span className="guide-step-title">{step.title}</span>
                      <span className="guide-step-text">{step.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <h1>{t.onboarding.readerTitle}</h1>
              <p className="lead">{t.onboarding.readerLead}</p>
              <div className="guide-reader plain">
                <ul>
                  {t.onboarding.reader.map((item) => (
                    <li key={item.label}>
                      <span>
                        <b>{item.label}</b>
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <div className="guide-pager">
            <button
              type="button"
              onClick={() => setPage(0)}
              disabled={page === 0}
            >
              {t.guide.prev}
            </button>
            <span className="guide-pager-dots" aria-hidden="true">
              <i className={page === 0 ? "on" : ""} />
              <i className={page === 1 ? "on" : ""} />
            </span>
            {page === 0 ? (
              <button
                type="button"
                className="primary"
                onClick={() => setPage(1)}
              >
                {t.guide.readerTab}
              </button>
            ) : (
              <button type="button" className="primary" onClick={onClose}>
                {t.guide.finish}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
