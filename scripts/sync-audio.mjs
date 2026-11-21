// 把背景音乐复制到 public/audio/。
// 优先使用 background-music/ 下的本地文件（第三方素材，已被 .gitignore 忽略），
// 缺失时回落到 assets/audio-fallback/ 下的 CC0 合成音。
// 在 dev / build / start 前自动执行（见 package.json 的 pre* 脚本）。
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "audio");

const TRACKS = ["rain-loop.mp3", "piano-loop.mp3"];

mkdirSync(outDir, { recursive: true });

for (const name of TRACKS) {
  const local = join(root, "background-music", name);
  const fallback = join(root, "assets", "audio-fallback", name);
  const from = existsSync(local) ? local : existsSync(fallback) ? fallback : null;
  const to = join(outDir, name);

  if (!from) {
    console.warn(`[sync-audio] 缺少音源，跳过：${name}（可放入 background-music/ 或 assets/audio-fallback/）`);
    continue;
  }
  if (
    existsSync(to) &&
    statSync(to).size === statSync(from).size &&
    statSync(to).mtimeMs >= statSync(from).mtimeMs
  ) {
    continue;
  }
  copyFileSync(from, to);
  const origin = from === local ? "background-music" : "assets/audio-fallback";
  console.log(`[sync-audio] ${origin}/${name} -> public/audio/${name}`);
}
