import { createHash } from "crypto";
import { getDeepSeekKey, getDeepSeekUrl } from "@/lib/config";
import type { Locale } from "@/i18n";

const DEEPSEEK_URL = getDeepSeekUrl();
export const TRANSLATE_MODEL_VERSION = "deepseek-flash-v1";

// 译文语言属于缓存键的一部分：中英文译文必须分开存，否则英文用户会读到中文译文。
export function translateVersion(locale: Locale): string {
  return locale === "en"
    ? `${TRANSLATE_MODEL_VERSION}-en`
    : TRANSLATE_MODEL_VERSION;
}

// 原文内容 hash，用于检测段落内容是否变化
export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

// 调用 DeepSeek 翻译单段文本，只输出译文
export async function translateText(
  text: string,
  locale: Locale = "zh",
): Promise<string> {
  // 空段落（纯图片/空白块）不发给模型，避免模型回复"没有提供文本"之类的说明
  if (!text.trim()) return "";

  const apiKey = await getDeepSeekKey();
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY");

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-flash",
      messages: [
        {
          role: "system",
          content:
            locale === "en"
              ? "你是翻译助手。把用户给的文本翻译成英文，只输出译文本身，不要任何解释、前缀或引号。只求通顺、看懂大意，不需要逐字精确。"
              : "你是翻译助手。把用户给的文本翻译成简体中文，只输出译文本身，不要任何解释、前缀或引号。只求通顺、看懂大意，不需要逐字精确。",
        },
        { role: "user", content: text },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek 请求失败：HTTP ${res.status}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("DeepSeek 返回为空");
  }
  return content.trim();
}
