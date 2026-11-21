/* 每日研读 Service Worker：只缓存不可变的静态资源（/_next/static/…，文件名带
   构建哈希）与离线外壳，不缓存 API、RSC 导航负载，避免重新构建后仍然先渲染
   上一版本的界面。 */
// 缓存名需随框架大版本升级递增：旧缓存里的 HTML 会引用已不存在的
// /_next/static 旧哈希 chunk，离线打开会白屏。
const CACHE = "daily-reading-v8";
const SHELLS = ["/", "/today"];

// 安装时预缓存应用外壳：首次访问时页面由网络直接返回，SW 尚未接管，
// 若不主动抓取，装成 PWA 后断网点图标会一直停在启动画面。
async function precacheShells() {
  const cache = await caches.open(CACHE);
  for (const path of SHELLS) {
    try {
      const res = await fetch(path, { cache: "reload" });
      if (!res || !res.ok) continue;
      const html = await res.clone().text();
      await cache.put(path, res);
      const assets = Array.from(
        new Set(
          (html.match(/\/_next\/static\/[^"'\\\s>]+/g) || []).map((u) =>
            u.replace(/&amp;/g, "&"),
          ),
        ),
      );
      await Promise.all(
        assets.map(async (url) => {
          try {
            if (await cache.match(url)) return;
            const asset = await fetch(url);
            if (asset && asset.status === 200) await cache.put(url, asset);
          } catch {
            // 单个静态资源失败不影响整体安装
          }
        }),
      );
    } catch {
      // 某个外壳抓取失败不影响其他外壳
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShells().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API 数据一律走网络，不缓存：避免 Service Worker 把旧的 { pack: null } 等
  // 响应缓存下来，导致“生成后页面不刷新”。
  if (url.pathname.startsWith("/api/")) return;

  // App Router 客户端导航取的是 RSC 负载（?_rsc=…）。这类请求一旦被缓存，
  // 重新构建后点击顶栏仍会先拿到旧负载 / 旧 chunk 引用，出现“先显示上一版界面
  // 再刷新”的现象，因此必须完全绕过缓存。
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

  // 导航请求：网络优先，失败回退缓存（离线可打开应用外壳）
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // 只缓存成功的 HTML，避免把 5xx/404 页面存下来供离线回退
          if (res && res.ok) {
            const clone = res.clone();
            event.waitUntil(
              caches.open(CACHE).then((c) => c.put(request, clone)),
            );
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // 未缓存过这个导航地址时退回根路径；两者都没有就交给网络错误
          const shell = await caches.match("/");
          if (shell) return shell;
          throw new Error("offline");
        }),
    );
    return;
  }

  // 只有带构建哈希的静态资源才缓存优先；其余（HTML、JSON 等）交给浏览器网络层
  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
    }),
  );
});
