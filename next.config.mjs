/** @type {import('next').NextConfig} */
const nextConfig = {
  // 仅 Docker 构建时产出 standalone（Dockerfile 传 NEXT_STANDALONE=1）；
  // Windows 原生 next start 部署不产出，避免本机构建卡住
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  // jszip 为纯 JS，交给打包器内联即可；设为 external 时 Turbopack 会生成
  // 带哈希的模块名（jszip-xxxx），构建期解析失败。
  experimental: {
    // 关闭客户端路由缓存：本项目页面数据都在浏览器端拉取，复用旧的 RSC 负载
    // 会让顶栏跳转先渲染上一版界面，再被新数据替换。
    // Next.js 16 起 static 最小值为 30，无法设为 0。
    staleTimes: { dynamic: 0, static: 30 },
  },
};

export default nextConfig;
