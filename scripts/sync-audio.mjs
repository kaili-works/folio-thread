// 把 background-music/ 里的原始音源同步到 public/audio/。
// public 目录只能对外提供自身文件，所以用复制而不是引用；
// 在 dev / build / start 前自动执行（见 package.json 的 pre* 脚本）。
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "audio");

// [background-music 下的源文件, public/audio 下的文件名]
// 两首均由 scripts/make_audio.py 纯程序合成（无第三方录音），以 CC0 发布，见 NOTICE。
const PAIRS = [
  ["rain-loop.mp3", "rain-loop.mp3"],
  ["piano-loop.mp3", "piano-loop.mp3"],
];

mkdirSync(outDir, { recursive: true });

for (const [src, dest] of PAIRS) {
  const from = join(root, "background-music", src);
  const to = join(outDir, dest);
  if (!existsSync(from)) {
    console.warn(`[sync-audio] 缺少音源，跳过：background-music/${src}`);
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
  console.log(`[sync-audio] background-music/${src} -> public/audio/${dest}`);
}
