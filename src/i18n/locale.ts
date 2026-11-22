// 语言常量：客户端与服务端共用，不要在这里引入 next/headers 等仅服务端的模块。
export type Locale = "zh" | "en";

export const LOCALE_COOKIE = "locale";

/** 把任意输入收敛成受支持的语言；不认识就返回 null，交给上层决定兜底。 */
export function parseLocale(value: unknown): Locale | null {
  return value === "en" || value === "zh" ? value : null;
}
