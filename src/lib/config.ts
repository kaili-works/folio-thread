// 服务端配置读取入口。
// 文本生成统一走 OpenAI 兼容的 /chat/completions：DeepSeek、OpenAI 与其它兼容服务
// 都只需要换 provider / key / base URL / model，调用方不感知具体厂商。

export type AiProvider = "deepseek" | "openai" | "custom";

export type AiConfig = {
  provider: AiProvider;
  key: string;
  url: string;
  model: string;
  configured: boolean;
};

const DEFAULTS: Record<Exclude<AiProvider, "custom">, { url: string; model: string }> = {
  deepseek: {
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-flash",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
};

// 没显式指定 provider 时按 base URL / 模型名推断，避免 OpenAI 用户只填 key + model 时打错地址。
function resolveProvider(
  value: string | undefined,
  url: string,
  model: string,
): AiProvider {
  const explicit = value?.trim().toLowerCase();
  if (explicit === "deepseek" || explicit === "openai" || explicit === "custom") {
    return explicit;
  }
  if (url.includes("openai.com")) return "openai";
  if (/^(gpt-|o[1-9])/i.test(model)) return "openai";
  return "deepseek";
}

export function getAiConfig(): AiConfig {
  const urlInput = (
    process.env.AI_BASE_URL ||
    process.env.DEEPSEEK_BASE_URL ||
    ""
  ).trim();
  const modelInput = (process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || "").trim();
  const provider = resolveProvider(process.env.AI_PROVIDER, urlInput, modelInput);
  const defaults = provider === "custom" ? null : DEFAULTS[provider];

  const key = (process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || "").trim();
  const url = urlInput || defaults?.url || "";
  const model = modelInput || defaults?.model || "";

  return { provider, key, url, model, configured: Boolean(key && url && model) };
}

export async function getAiKey(): Promise<string> {
  return getAiConfig().key;
}

export async function getWeReadKey(): Promise<string> {
  return process.env.WEREAD_API_KEY ?? "";
}
