import type { Locale } from "@/i18n/locale";

// 界面里的时长统一从这里出，避免各词典/组件各写一遍单位。
export function formatDuration(minutes: number, locale: Locale): string {
  return locale === "en" ? `${minutes} min` : `${minutes} 分钟`;
}
