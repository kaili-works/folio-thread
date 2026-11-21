# FolioThread · 页脉研读

Turn a question into a reading plan: generate a themed book list, read a little every day, and keep notes in one place.

把一句想研究的问题变成一个主题，自动拆成每日可读的清单，读完留下笔记与统计。

## Quick start（约 5 分钟）

### 1. 建库（Supabase）

1. 新建一个 Supabase 项目。
2. 打开 **SQL Editor**，整段执行 [`database/init.sql`](database/init.sql)（等价于按 `0001`→`0008` 顺序执行迁移）。
3. 打开 **Storage**，新建一个 **私有** bucket，名字必须是 `shared`。
4. 打开 **Authentication → Providers → Email**，关闭 **Confirm email**（否则注册后无法直接登录）。

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

至少填写这三项（Supabase Dashboard → Project Settings → API）：

```ini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

其余变量都是可选的，缺失时应用会自动降级（见下文）。

### 3. 启动

```bash
npm ci
npm run dev
```

打开 <http://localhost:3000>，注册账号并创建第一个主题。

### 4. 自检

```bash
npm run doctor                      # 环境变量 + 13 张核心表
curl "localhost:3000/api/health?db=1"   # 页面运行后再查一次
```

`npm run doctor` 会明确告诉你缺哪个变量、缺哪张表；缺表时回到第 1 步执行 `init.sql`。

## Docker

> 这是可选路径：CI 会构建镜像并检查 `/api/health`（推送到 GitHub 后生效）。作者的日常部署不使用容器，见下方「本机部署」。

```bash
cp .env.example .env    # 填写三个必填项
docker compose up --build
```

说明：

- `NEXT_PUBLIC_*` 在构建期内联进客户端代码，**改了这两个值必须重新 build**。
- 容器健康检查调用 `/api/health`，环境变量缺失时会显示 unhealthy。
- 构建阶段由 `scripts/sync-audio.mjs` 自动生成 `public/audio/`，无需手动准备音频。

## 本机部署

```bash
npm ci
npm run build
npm start
```

服务监听 `3000` 端口。远程访问走 Tailscale 域名，手机浏览器添加到主屏后以独立窗口运行。该路径不产出 `.next/standalone`，因此构建比容器方式更快（见 `next.config.mjs`）。

## 可选集成（全部可缺省）

| 变量 | 缺失时的表现 |
| --- | --- |
| `DEEPSEEK_API_KEY` | 清单走规则生成；翻译、归类、知识点提示不可用 |
| `WEREAD_API_KEY` | 隐藏「微信读书可读」入口与标签 |
| `EDGE_TTS_PYTHON` / `AZURE_SPEECH_KEY` | 跳过对应语音，回落到浏览器内置语音 |

## 背景音乐（可选）

仓库不附带第三方音乐。听书模式的背景音按以下顺序取用：

1. `background-music/rain-loop.mp3`、`background-music/piano-loop.mp3`（自行放入，已被 `.gitignore` 忽略）；
2. 缺失时回落到 `assets/audio-fallback/` 下由 `scripts/make_audio.py` 生成的 CC0 合成音。

使用自己的音乐时，按这两个文件名放入 `background-music/` 即可，`npm run dev` / `npm run build` 会自动同步到 `public/audio`。作者本地使用的 Pixabay 曲目与许可说明见 [NOTICE](NOTICE)。

## 自带书籍

仓库**不包含任何书籍正文或封面**。导入的 EPUB 只写入你自己的 Supabase 项目与 Storage。支持界面导入，也可用：

```bash
npm run import -- ./path/to/book.epub
```

## 已知限制

- 限流为进程内实现，只对单实例有效；多实例部署需要外部存储。
- 应用不提供数据库备份，备份与恢复由部署者负责。
- AI 生成的书单、翻译与知识点可能有误，请自行判断。

## License

代码以 MIT 发布，见 [LICENSE](LICENSE)。第三方背景音乐不入库，来源与许可见 [NOTICE](NOTICE)；仓库内的兜底音频由 `scripts/make_audio.py` 合成，以 CC0 发布。
