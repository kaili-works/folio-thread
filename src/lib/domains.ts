import type { Locale } from "@/i18n/locale";

// 阅读领域标签：统计页按领域分篮子。
// 数据库里统一存 key；历史数据存的是中文标签，读取时一并归一成 key。
// 顺序即页面展示顺序，「其他」固定最后。

export const DOMAIN_KEYS = [
  "mind_growth",
  "society_history",
  "business_economics",
  "philosophy_ideas",
  "literature_writing",
  "science_tech",
  "health_living",
  "arts_culture",
  "biography_people",
  "other",
] as const;

export type DomainKey = (typeof DOMAIN_KEYS)[number];

export const DOMAIN_LABELS: Record<DomainKey, { zh: string; en: string }> = {
  mind_growth: { zh: "心理与成长", en: "Mind & Growth" },
  society_history: { zh: "社会与历史", en: "Society & History" },
  business_economics: { zh: "经济与管理", en: "Business & Economics" },
  philosophy_ideas: { zh: "哲学与思想", en: "Philosophy & Ideas" },
  literature_writing: { zh: "文学与写作", en: "Literature & Writing" },
  science_tech: { zh: "科学与技术", en: "Science & Technology" },
  health_living: { zh: "健康与生活", en: "Health & Living" },
  arts_culture: { zh: "艺术与文化", en: "Arts & Culture" },
  biography_people: { zh: "传记与人物", en: "Biography & People" },
  other: { zh: "其他", en: "Other" },
};

export const FALLBACK_DOMAIN: DomainKey = "other";

// 迁移前的旧值：主题表里存的是中文标签
const LEGACY_ZH: Record<string, DomainKey> = Object.fromEntries(
  DOMAIN_KEYS.map((key) => [DOMAIN_LABELS[key].zh, key]),
) as Record<string, DomainKey>;

export function normalizeDomain(value: unknown): DomainKey | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if ((DOMAIN_KEYS as readonly string[]).includes(v)) return v as DomainKey;
  return LEGACY_ZH[v] ?? null;
}

export function domainOrDefault(value: unknown): DomainKey {
  return normalizeDomain(value) ?? FALLBACK_DOMAIN;
}

/** 展示用文案：key 或历史中文标签都能翻译。 */
export function domainLabel(value: unknown, locale: Locale): string {
  return DOMAIN_LABELS[domainOrDefault(value)][locale === "en" ? "en" : "zh"];
}
