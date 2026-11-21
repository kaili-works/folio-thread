"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n";

// 文案按语言实时渲染：错误提示只存类型与参数，切换语言后跟着变。
type Message =
  | { kind: "loginFailed"; error: string }
  | { kind: "registerFailed"; error: string }
  | { kind: "registerSuccess" };

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const t = useT();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) return;
      // 离线时客户端路由拿不到 RSC 负载，改为整页跳转，交给 Service Worker
      // 返回预缓存的 /today 外壳
      if (!navigator.onLine) window.location.replace("/today");
      else router.push("/today");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) {
      setMessage({ kind: "loginFailed", error: error.message });
      return;
    }
    if (data.user) {
      router.push("/today");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setMessage({ kind: "registerFailed", error: error.message });
      return;
    }
    if (data.session?.user) {
      router.push("/today");
    } else {
      setMessage({ kind: "registerSuccess" });
      setMode("login");
    }
  }

  const isLogin = mode === "login";
  const messageText = message
    ? message.kind === "registerSuccess"
      ? t.auth.registerSuccess
      : message.kind === "loginFailed"
        ? t.auth.loginFailed(message.error)
        : t.auth.registerFailed(message.error)
    : null;

  return (
    <div className="auth-wrap">
      <div className="auth-split">
        <aside className="auth-brand">
          <span className="kicker">{t.auth.brandKicker}</span>
          <h1>{t.auth.brandTitle}</h1>
          <p className="lead">{t.auth.brandLead}</p>
          <ol className="auth-steps">
            {t.auth.steps.map((step, i) => (
              <li key={i}>
                <b>{i + 1}</b>
                {step}
              </li>
            ))}
          </ol>
          <p className="auth-foot">{t.auth.foot}</p>
        </aside>

        <main className="auth-panel">
          <div className="auth-intro">
            <h2>{isLogin ? t.auth.loginTitle : t.auth.registerTitle}</h2>
            <p>{isLogin ? t.auth.loginIntro : t.auth.registerIntro}</p>
          </div>

          <div className="auth-switch">
            <button
              type="button"
              className={isLogin ? "active" : ""}
              onClick={() => {
                setMode("login");
                setMessage(null);
              }}
            >
              {t.auth.tabLogin}
            </button>
            <button
              type="button"
              className={!isLogin ? "active" : ""}
              onClick={() => {
                setMode("register");
                setMessage(null);
              }}
            >
              {t.auth.tabRegister}
            </button>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister}>
            <label>{t.auth.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label>{t.auth.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={busy}
              style={{ width: "100%", marginTop: 6 }}
            >
              {busy
                ? isLogin
                  ? t.auth.signingIn
                  : t.auth.creating
                : isLogin
                  ? t.auth.login
                  : t.auth.register}
            </button>
          </form>

          {message && (
            <p
              className={`message ${message.kind === "registerSuccess" ? "ok" : "err"}`}
              style={{ marginTop: 14, marginBottom: 0 }}
            >
              {messageText}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
