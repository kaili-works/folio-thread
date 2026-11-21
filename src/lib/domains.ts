// 阅读领域标签：统计页按领域分篮子。
// 顺序即页面展示顺序，「其他」固定最后。

export const DOMAINS = [
  "心理与成长",
  "社会与历史",
  "经济与管理",
  "哲学与思想",
  "文学与写作",
  "科学与技术",
  "健康与生活",
  "艺术与文化",
  "传记与人物",
  "其他",
] as const;

export type Domain = (typeof DOMAINS)[number];

export const FALLBACK_DOMAIN: Domain = "其他";

export function normalizeDomain(value: unknown): Domain | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return (DOMAINS as readonly string[]).includes(v) ? (v as Domain) : null;
}

export function domainOrDefault(value: unknown): Domain {
  return normalizeDomain(value) ?? FALLBACK_DOMAIN;
}
