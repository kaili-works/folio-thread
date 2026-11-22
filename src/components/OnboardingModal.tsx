"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";

const KEY = "dr_onboarding_v4";
const LAST = 2;

// 与登录页左侧同源的叶脉线稿：墨绿底 + 浅绿细线，仅用于装点三屏
function Motif({ variant }: { variant: 1 | 2 | 3 }) {
  return (
    <svg
      viewBox="0 0 480 200"
      fill="none"
      stroke="#cbd9c1"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {variant === 1 && (
        <>
          {/* 土丘与嫩芽 */}
          <path
            d="M150 176 C 190 166 290 166 330 176"
            stroke="#9aab8f"
            strokeWidth={1.6}
            opacity={0.55}
          />
          <path
            d="M124 188 C 182 174 298 174 356 188"
            stroke="#9aab8f"
            strokeWidth={1.4}
            opacity={0.3}
          />
          <path
            d="M210 169 C 224 161 256 161 270 169"
            stroke="#9aab8f"
            strokeWidth={1.6}
            opacity={0.7}
          />
          <path d="M240 160 C 236 136 238 112 244 88" />
          <path d="M240 136 234 139M244 88 246 87M244 88 243 78" stroke="#cbd9c1" strokeWidth={2} />
          {/* 叶：菱形纸片（与页脉标记同形） */}
          <g transform="translate(222 124) rotate(-34)">
            <path d="M0-20 20 0 0 20-20 0Z" fill="#f2efe2" stroke="#cbd9c1" strokeWidth={1.4} />
          </g>
          <g transform="translate(263 95) rotate(26)">
            <path d="M0-19 19 0 0 19-19 0Z" fill="#f2efe2" stroke="#cbd9c1" strokeWidth={1.4} />
          </g>
          <g transform="translate(245 64) rotate(8)">
            <path d="M0-13 13 0 0 13-13 0Z" fill="#f2efe2" stroke="#cbd9c1" strokeWidth={1.3} />
          </g>
        </>
      )}

      {variant === 2 && (
        <>
          {/* 一条横枝，四片菱形纸对应四步 */}
          <path d="M56 148 C 124 144 176 128 226 108 C 280 86 340 66 424 60" />
          <g transform="translate(112 126) rotate(-32)">
            <path d="M0-17 17 0 0 17-17 0Z" fill="#f2efe2" stroke="#cbd9c1" strokeWidth={1.4} />
          </g>
          <g transform="translate(212 104) rotate(26)">
            <path d="M0-16 16 0 0 16-16 0Z" fill="#f2efe2" stroke="#cbd9c1" strokeWidth={1.4} />
          </g>
          <g transform="translate(246 79) rotate(-28)">
            <path d="M0-16 16 0 0 16-16 0Z" fill="#f2efe2" stroke="#cbd9c1" strokeWidth={1.4} />
          </g>
          <g transform="translate(346 55) rotate(26)">
            <path d="M0-15 15 0 0 15-15 0Z" fill="#f2efe2" stroke="#cbd9c1" strokeWidth={1.4} />
          </g>
          <circle cx="424" cy="60" r="3" stroke="#9aab8f" strokeWidth={1.6} />
        </>
      )}

      {variant === 3 && (
        <>
          {/* 错落堆叠的书：实底填充遮住下层轮廓，避免线条互相穿插 */}
          <g>
            <rect x="108" y="154" width="260" height="20" rx="4" fill="#2f3a30" />
            <path d="M117 170 H 359" stroke="#9aab8f" strokeWidth={1.4} />
          </g>
          <g transform="rotate(1.2 233 145)">
            <rect x="124" y="136" width="218" height="18" rx="4" fill="#2f3a30" />
            <path d="M133 150 H 333" stroke="#9aab8f" strokeWidth={1.4} />
          </g>
          <g transform="rotate(-1.5 240 130)">
            <rect x="150" y="122" width="180" height="16" rx="3" fill="#2f3a30" />
            <path d="M158 134 H 322" stroke="#9aab8f" strokeWidth={1.4} />
          </g>
          <g transform="rotate(1.6 236 117)">
            <rect x="166" y="110" width="140" height="14" rx="3" fill="#2f3a30" />
            <path d="M173 120 H 299" stroke="#9aab8f" strokeWidth={1.4} />
          </g>
          <g transform="rotate(-9 236 95)">
            <rect x="174" y="88" width="124" height="14" rx="3" fill="#2f3a30" />
            <path d="M182 98 H 290" stroke="#9aab8f" strokeWidth={1.4} />
          </g>
        </>
      )}
    </svg>
  );
}

// 首次登录后的一次性引导：三屏轮播，最后一屏只关闭弹窗
export default function OnboardingModal() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      // 隐私模式下 localStorage 不可用时直接不弹
    }
  }, []);

  function close() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // 忽略写入失败
    }
    setOpen(false);
  }

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function goNext() {
    setIndex((i) => Math.min(LAST, i + 1));
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.onboarding.aria}
      className="onboarding-overlay"
      onClick={close}
    >
      <div
        className="onboarding-card"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (dx > 50) goPrev();
          else if (dx < -50) goNext();
          touchStartX.current = null;
        }}
      >
        <div className="onboarding-topbar">
          <span className="onboarding-step">{t.onboarding.step(index + 1)}</span>
          <button
            className="onboarding-close"
            aria-label={t.onboarding.closeLabel}
            onClick={close}
          >
            ×
          </button>
        </div>

        <div className="onboarding-viewport">
          <div
            className="onboarding-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {/* 第一屏：应用介绍 */}
            <section className="onboarding-slide" aria-hidden={index !== 0}>
              <div className="onboarding-figure">
                <Motif variant={1} />
              </div>
              <div className="onboarding-copy">
                <p className="onboarding-kicker">{t.onboarding.kicker[0]}</p>
                <h2 className="onboarding-title">{t.onboarding.title}</h2>
                <p className="onboarding-body">{t.onboarding.intro}</p>
              </div>
            </section>

            {/* 第二屏：四步顺序 */}
            <section className="onboarding-slide" aria-hidden={index !== 1}>
              <div className="onboarding-figure">
                <Motif variant={2} />
              </div>
              <div className="onboarding-copy">
                <p className="onboarding-kicker">{t.onboarding.kicker[1]}</p>
                <ol className="onboarding-steps">
                  {t.onboarding.steps.map((step, i) => (
                    <li key={step.title}>
                      <span className="onboarding-step-index">0{i + 1}</span>
                      <span>
                        <span className="onboarding-step-title">{step.title}</span>
                        <span className="onboarding-step-text"> — {step.text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* 第三屏：开始 */}
            <section className="onboarding-slide" aria-hidden={index !== 2}>
              <div className="onboarding-figure">
                <Motif variant={3} />
              </div>
              <div className="onboarding-copy">
                {t.onboarding.kicker[2] && (
                  <p className="onboarding-kicker">{t.onboarding.kicker[2]}</p>
                )}
                <h2 className="onboarding-title">{t.onboarding.startTitle}</h2>
              </div>
            </section>
          </div>
        </div>

        <div className="onboarding-footer">
          <div className="onboarding-dots">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                className={`onboarding-dot${index === i ? " active" : ""}`}
                aria-label={t.onboarding.slideLabel(i + 1)}
                aria-current={index === i}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <div className="onboarding-actions">
            {index > 0 && (
              <button className="onboarding-prev" onClick={goPrev}>
                {t.onboarding.prev}
              </button>
            )}
            {index < LAST ? (
              <button className="onboarding-next" onClick={goNext}>
                {t.onboarding.next}
              </button>
            ) : (
              <button className="onboarding-start" onClick={close}>
                {t.onboarding.startCta}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
