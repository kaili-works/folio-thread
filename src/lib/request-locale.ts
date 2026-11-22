import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/i18n/locale";

/**
 * 服务端解析当前请求的语言，只在这里决定一次：
 * 1. cookie —— 用户在界面上显式选过，优先级最高；
 * 2. Accept-Language —— 首次访问按浏览器语言判断；
 * 3. 兜底英文 —— 开源项目的默认展示语言。
 * 页面渲染与 AI 生成内容都调用它，保证两边语言一致。
 */
export async function getRequestLocale(): Promise<Locale> {
  const explicit = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  if (explicit) return explicit;

  const accept = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  return accept.includes("zh") ? "zh" : "en";
}
