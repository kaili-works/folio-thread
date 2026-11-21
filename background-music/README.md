# background-music

本地背景音乐目录。**这里的 mp3 不进版本库**（见仓库根 `.gitignore`），因为第三方素材
（如 Pixabay）通常不允许原样再分发。

`scripts/sync-audio.mjs` 会按以下优先级取文件并复制到 `public/audio/`：

1. `background-music/rain-loop.mp3`、`background-music/piano-loop.mp3`
2. 缺失时回落到 `assets/audio-fallback/` 下的 CC0 合成音

想换成自己喜欢的曲子，把文件按上面两个名字放进来即可，`npm run dev` / `npm run build`
会自动同步。仓库不分发这些文件，Docker 构建也会排除它们。

作者本地使用的曲目与许可说明见仓库根目录 `NOTICE`。
