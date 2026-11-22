"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/client";
import { clearUserCache } from "@/lib/offline";
import { useI18n } from "@/i18n";

// 账户页：查看登录邮箱 + 删除账号（后端 /api/account 已实现）
export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      if (!u) {
        setLoading(false);
        router.replace("/");
        return;
      }
      setUserId(u.id);
      setEmail(u.email ?? "");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeAccount() {
    if (typed.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setError(t.account.mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(t.account.failed(json.error ?? res.status));
      return;
    }
    if (userId) await clearUserCache(userId);
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <>
      <AppNav />
      <div className="container app-main account-page">
        <div className="page-head">
          <span className="kicker">{t.account.kicker}</span>
          <h1>{t.account.title}</h1>
          <p className="sub">{t.account.intro}</p>
        </div>

        <section className="card account-card">
          <div className="account-label">{t.account.emailLabel}</div>
          <div className="account-value">
            {loading ? t.account.loading : email || t.account.signedOutHint}
          </div>
        </section>

        <section className="card account-card">
          <div className="account-label">{t.account.dataTitle}</div>
          <p className="muted account-text">{t.account.dataBody}</p>
        </section>

        <section className="card account-card danger">
          <span className="kicker">{t.account.dangerKicker}</span>
          <h2>{t.account.deleteTitle}</h2>
          <p className="muted account-text">{t.account.deleteBody}</p>
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={() => {
              setTyped("");
              setError(null);
              setConfirming(true);
            }}
          >
            {t.account.deleteCta}
          </button>
        </section>
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.account.confirmTitle}
          className="onboarding-overlay"
          onClick={() => {
            if (!busy) setConfirming(false);
          }}
        >
          <div
            className="account-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{t.account.confirmTitle}</h2>
            <p className="muted account-text">
              {t.account.confirmBody(email)}
            </p>
            <input
              type="email"
              value={typed}
              autoFocus
              placeholder={t.account.confirmPlaceholder}
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
            />
            {error && <p className="message err">{error}</p>}
            <div className="account-dialog-actions">
              <button
                type="button"
                className="btn-ghost btn-sm"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                {t.account.cancel}
              </button>
              <button
                type="button"
                className="btn-danger btn-sm"
                disabled={busy}
                onClick={removeAccount}
              >
                {busy ? t.account.deleting : t.account.confirmCta}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
