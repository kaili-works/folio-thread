#!/usr/bin/env node
/**
 * 冒烟验证脚本（零依赖，Node 18+）。
 *
 * 覆盖 `测试清单.md` 中可脚本化的部分：
 *   - 静态门禁：迁移文件完整性、.env.example 变量、敏感文件未入库、客户端 bundle 无 service_role
 *   - 构建（可选）：tsc --noEmit、next build
 *   - HTTP 冒烟：主要页面 200、未登录接口全部 401、sw.js / manifest / 音频可用
 *
 * 不覆盖（仍需人工）：真实登录后的交互、PWA 安装与断网、手机真机、无 Key 降级矩阵、跨用户越权。
 *
 * 用法：
 *   node scripts/verify.mjs                 静态 + HTTP（服务未启动则跳过 HTTP）
 *   node scripts/verify.mjs --build         额外执行 tsc 与 next build
 *   node scripts/verify.mjs --no-http       只做静态检查
 *   node scripts/verify.mjs --base=http://localhost:3000
 *
 * 退出码：存在 FAIL 时为 1；WARN / SKIP 不影响。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const pick = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = pick("base", process.env.VERIFY_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const RUN_BUILD = flag("build");
const NO_HTTP = flag("no-http");
const TIMEOUT_MS = 10_000;
const TTY = Boolean(process.stdout.isTTY);
const paint = (code, text) => (TTY ? `\x1b[${code}m${text}\x1b[0m` : text);

const results = [];
function report(status, name, detail = "") {
  results.push({ status, name });
  const tag = {
    PASS: paint(32, "PASS"),
    FAIL: paint(31, "FAIL"),
    WARN: paint(33, "WARN"),
    SKIP: paint(90, "SKIP"),
  }[status];
  console.log(`  ${tag}  ${name}${detail ? paint(90, ` — ${detail}`) : ""}`);
}
const section = (title) => console.log(`\n${paint(1, title)}`);

function walkFiles(dir, predicate, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

/** 用 node 直接跑本地脚本，避开 Windows 下 npx.cmd 的启动问题。 */
function runNodeScript(label, scriptPath, scriptArgs) {
  const started = Date.now();
  try {
    execFileSync(process.execPath, [join(ROOT, scriptPath), ...scriptArgs], {
      cwd: ROOT,
      stdio: "inherit",
    });
    report("PASS", label, `${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch {
    report("FAIL", label, "见上方输出");
  }
}

// ---------------------------------------------------------------- 1. 静态门禁
section("1. 静态门禁");

const dbDir = join(ROOT, "database");
const migrations = existsSync(dbDir)
  ? readdirSync(dbDir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
  : [];
if (migrations[0]?.startsWith("0001_") && migrations.length >= 8) {
  report("PASS", "数据库迁移文件完整", `0001 → ${migrations.at(-1)}，共 ${migrations.length} 个`);
} else {
  report("FAIL", "数据库迁移文件缺失", migrations.length ? migrations.join(", ") : "database/ 不存在或为空");
}

const envExamplePath = join(ROOT, ".env.example");
const envExample = existsSync(envExamplePath) ? readFileSync(envExamplePath, "utf8") : "";
const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "WEREAD_API_KEY",
  "WEREAD_SKILL_VERSION",
  "AZURE_SPEECH_KEY",
  "AZURE_SPEECH_REGION",
  "EDGE_TTS_PYTHON",
  "EDGE_TTS_DISABLED",
];
const missingEnv = REQUIRED_ENV.filter((key) => !new RegExp(`^${key}=`, "m").test(envExample));
if (!envExample) report("FAIL", ".env.example 不存在");
else if (missingEnv.length) report("WARN", ".env.example 变量不全", `缺 ${missingEnv.length} 个：${missingEnv.join(", ")}`);
else report("PASS", ".env.example 变量齐全", `${REQUIRED_ENV.length} 个`);

try {
  const tracked = execFileSync(
    "git",
    ["ls-files", "--", ".env", ".env.local", "public/audio", ".next"],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  )
    .split("\n")
    .filter(Boolean);
  if (tracked.length) report("FAIL", "敏感/生成文件已被 git 跟踪", tracked.slice(0, 5).join(", "));
  else report("PASS", "无 .env / public/audio / .next 入库");
} catch {
  report("SKIP", "git 跟踪检查", "当前目录不是 git 仓库");
}

const staticDir = join(ROOT, ".next", "static");
if (!existsSync(staticDir)) {
  report("SKIP", "客户端 bundle 密钥扫描", "尚无 .next/static，先构建");
} else {
  const hits = walkFiles(
    staticDir,
    (file) => file.endsWith(".js") && statSync(file).size < 8 * 1024 * 1024,
  ).filter((file) => {
    const text = readFileSync(file, "utf8");
    return text.includes("service_role") || text.includes("SUPABASE_SERVICE_ROLE_KEY");
  });
  if (hits.length) report("FAIL", "客户端 bundle 出现 service_role", hits.slice(0, 3).map((f) => relative(ROOT, f)).join(", "));
  else report("PASS", "客户端 bundle 无 service_role");
}

// ---------------------------------------------------------------- 2. 构建
section("2. 构建");
if (RUN_BUILD) {
  runNodeScript("tsc --noEmit", "node_modules/typescript/bin/tsc", ["--noEmit"]);
  runNodeScript("next build", "node_modules/next/dist/bin/next", ["build"]);
} else {
  report("SKIP", "tsc / next build", "加 --build 执行");
}

// ---------------------------------------------------------------- 3. HTTP
async function request(path, method = "GET", body) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

const PLACEHOLDER_UUID = "00000000-0000-0000-0000-000000000000";
const AUTH_MATRIX = [
  ["GET", "/api/daily-pack"],
  ["GET", "/api/library/pending"],
  ["GET", "/api/stats"],
  ["GET", "/api/stats/reading-time"],
  ["GET", "/api/documents"],
  ["GET", "/api/themes"],
  ["GET", "/api/market"],
  ["GET", "/api/annotations"],
  ["GET", `/api/books/${PLACEHOLDER_UUID}/reader`],
  ["POST", "/api/themes"],
  ["POST", "/api/market/random"],
  ["POST", "/api/translate"],
  ["POST", "/api/tts"],
  ["POST", "/api/progress"],
  ["POST", "/api/annotations"],
  ["POST", "/api/daily-pack/progress"],
  ["POST", "/api/stats/reading-time"],
  ["POST", "/api/lists/generate"],
  ["POST", "/api/lists/refresh"],
  ["POST", "/api/lists/regenerate"],
  ["POST", "/api/lists/keypoints"],
  ["POST", "/api/lists/replace-item"],
  ["POST", "/api/lists/weread-enrich"],
  ["POST", "/api/themes/classify"],
  ["POST", "/api/storage/sign"],
  ["POST", "/api/weread/sync"],
  ["PATCH", "/api/profile"],
  ["PATCH", `/api/themes/${PLACEHOLDER_UUID}`],
  ["DELETE", `/api/annotations/${PLACEHOLDER_UUID}`],
  ["DELETE", `/api/themes/${PLACEHOLDER_UUID}`],
  ["DELETE", `/api/documents/${PLACEHOLDER_UUID}`],
  ["DELETE", "/api/account"],
];

section(`3. HTTP 冒烟（${BASE}）`);
if (NO_HTTP) {
  report("SKIP", "HTTP 检查", "--no-http");
} else {
  let reachable = true;
  try {
    await request("/");
  } catch {
    reachable = false;
    report("SKIP", "服务可达性", `无法连接 ${BASE}；先 npm start，或加 --no-http`);
  }

  if (reachable) {
    for (const [path, expected] of [
      ["/", [200, 307]],
      ["/today", [200]],
      ["/themes", [200]],
      ["/library", [200]],
      ["/market", [200]],
      ["/stats", [200]],
    ]) {
      const res = await request(path);
      if (expected.includes(res.status)) report("PASS", `页面 ${path}`, String(res.status));
      else report("FAIL", `页面 ${path}`, `期望 ${expected.join("/")}，实际 ${res.status}`);
    }

    let unauthenticated = 0;
    for (const [method, path] of AUTH_MATRIX) {
      const hasBody = !["GET", "HEAD"].includes(method);
      const res = await request(path, method, hasBody ? {} : undefined);
      if (res.status === 401) {
        unauthenticated += 1;
        continue;
      }
      const hint =
        res.status === 200 ? "未鉴权即可访问" : res.status === 405 ? "路由不支持该方法" : "";
      report("FAIL", `${method} ${path}`, `期望 401，实际 ${res.status}${hint ? `（${hint}）` : ""}`);
    }
    if (unauthenticated === AUTH_MATRIX.length) {
      report("PASS", "未登录 401 矩阵", `${AUTH_MATRIX.length} 个接口全部 401`);
    }

    const tts = await request("/api/tts");
    if (tts.status === 200) report("PASS", "GET /api/tts 公开音色列表", "200");
    else report("FAIL", "GET /api/tts 公开音色列表", `期望 200，实际 ${tts.status}`);

    const health = await request("/api/health");
    if (health.status === 200) report("PASS", "GET /api/health", "200");
    else report("FAIL", "GET /api/health", `期望 200，实际 ${health.status}（检查环境变量）`);

    const sw = await request("/sw.js");
    if (sw.status !== 200) {
      report("FAIL", "GET /sw.js", `期望 200，实际 ${sw.status}`);
    } else {
      const text = await sw.text();
      const version = text.match(/daily-reading-v\d+/)?.[0];
      if (version && text.includes("_rsc")) report("PASS", "Service Worker", `${version}，含 _rsc 绕过`);
      else report("FAIL", "Service Worker", version ? "缺少 _rsc 绕过逻辑" : "未找到缓存版本常量");
    }

    const manifest = await request("/manifest.webmanifest");
    if (manifest.status !== 200) {
      report("FAIL", "GET /manifest.webmanifest", `期望 200，实际 ${manifest.status}`);
    } else {
      const json = await manifest.json();
      const icons = Array.isArray(json.icons) ? json.icons.length : 0;
      if (icons >= 3) report("PASS", "PWA manifest", `${icons} 个图标`);
      else report("WARN", "PWA manifest 图标不足", `当前 ${icons} 个，Chrome 安装需 192/512 PNG`);
    }

    const audio = await request("/audio/rain-loop.mp3");
    if (audio.status === 200) report("PASS", "背景音乐可访问", "rain-loop.mp3");
    else report("WARN", "背景音乐不可访问", `rain-loop.mp3 返回 ${audio.status}（检查 sync-audio 是否执行）`);
  }
}

// ---------------------------------------------------------------- 汇总
const count = (status) => results.filter((item) => item.status === status).length;
console.log(
  `\n${paint(1, "汇总")}  PASS ${count("PASS")} · FAIL ${count("FAIL")} · WARN ${count("WARN")} · SKIP ${count("SKIP")}`,
);
if (count("FAIL") > 0) {
  console.log(paint(31, "存在 FAIL，验证未通过。"));
  process.exitCode = 1;
} else {
  console.log(paint(32, "无 FAIL。"));
}
