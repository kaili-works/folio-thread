"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";

// 顶栏「指南」：沿用登录页左侧的深绿品牌栏风格，分两页展示
export default function GuideModal({ onClose }: { onClose: () => void }) {
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
      aria-label="操作指南"
      className="onboarding-overlay"
      onClick={onClose}
    >
      <div className="guide-card" onClick={(e) => e.stopPropagation()}>
        <button
          className="guide-close"
          aria-label="关闭操作指南"
          onClick={onClose}
        >
          ×
        </button>
        <aside className="auth-brand">
          <span className="kicker">Guide · 操作指南</span>

          {page === 0 ? (
            <>
              <h1>四步开始今天的阅读</h1>
              <p className="lead">
                不用先建书单，也不用先读完全书。跟着顺序走一遍，就能形成每天固定的阅读节奏。
              </p>
              <ol className="auth-steps">
                {copy.onboarding.steps.map((step, i) => (
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
              <h1>{copy.onboarding.readerTitle}</h1>
              <p className="lead">{copy.onboarding.readerLead}</p>
              <div className="guide-reader plain">
                <ul>
                  {copy.onboarding.reader.map((item) => (
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
              上一步
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
                阅读器功能 →
              </button>
            ) : (
              <button type="button" className="primary" onClick={onClose}>
                开始阅读
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
