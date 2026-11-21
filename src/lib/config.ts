// 服务端配置读取入口。
// 当前只从环境变量读取；后续接「网页设置」时，在这里改成先查用户设置、
// 再回落到环境变量即可，调用方无需改动。

export async function getDeepSeekKey(): Promise<string> {
  return process.env.DEEPSEEK_API_KEY ?? "";
}

// DeepSeek 接口地址：未配置时用官方地址，便于指向本地 stub 或自建代理。
export function getDeepSeekUrl(): string {
  return (
    process.env.DEEPSEEK_BASE_URL?.trim() ||
    "https://api.deepseek.com/chat/completions"
  );
}

export async function getWeReadKey(): Promise<string> {
  return process.env.WEREAD_API_KEY ?? "";
}
