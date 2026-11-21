"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // 只在生产环境注册：开发环境频繁改代码，SW 缓存静态资源会导致样式/脚本不刷新。
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // 新版本 SW 接管后刷新一次，避免手机端一直停在旧页面
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {
        // 注册失败不阻塞应用
      });
  }, []);

  return null;
}
