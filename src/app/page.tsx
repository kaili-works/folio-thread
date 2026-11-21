"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { copy } from "@/lib/copy";

export default function Home() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
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
      setMessage({ text: copy.auth.loginFailed(error.message), ok: false });
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
      setMessage({ text: copy.auth.registerFailed(error.message), ok: false });
      return;
    }
    if (data.session?.user) {
      router.push("/today");
    } else {
      setMessage({
        text: copy.auth.registerSuccess,
        ok: true,
      });
      setMode("login");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-split">
        <aside className="auth-brand">
          <span className="kicker">FolioThread</span>
          <h1>页脉研读</h1>
          <p className="lead">{copy.auth.subtitle}</p>
          <ol className="auth-steps">
            <li>
              <b>1</b>用一句话描述你想研究的主题
            </li>
            <li>
              <b>2</b>由 AI 为你推荐序列书单
            </li>
            <li>
              <b>3</b>每天按预算读一点，逐渐构建你的知识地图
            </li>
          </ol>
          <p className="auth-foot">主题研读导航 · 于书海中寻线织脉</p>
        </aside>

        <main className="auth-panel">
          <div className="auth-intro">
            <h2>{mode === "login" ? "继续今天的阅读" : "建立你的阅读档案"}</h2>
            <p>
              {mode === "login"
                ? "登录后回到今日阅读包。"
                : "注册后先描述一个主题，我们会为你排一份有序书单。"}
            </p>
          </div>

          <div className="auth-switch">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setMessage(null);
              }}
            >
              登录
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setMessage(null);
              }}
            >
              注册
            </button>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
            <label>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label>密码</label>
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
                ? mode === "login"
                  ? "登录中…"
                  : "注册中…"
                : mode === "login"
                  ? "登录"
                  : "注册"}
            </button>
          </form>

          {message && (
            <p
              className={`message ${message.ok ? "ok" : "err"}`}
              style={{ marginTop: 14, marginBottom: 0 }}
            >
              {message.text}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
