import type { Locale } from "@/i18n";

// AI 生成的推荐理由、知识点、市集文案都会直接展示给用户，
// 必须跟随界面语言，否则英文界面里会混入中文。

/** 输出语言约束，追加到各提示词末尾。 */
export function outputLanguageRule(locale: Locale): string {
  return locale === "en"
    ? "Output language: English. Keep book titles and author names in their original language."
    : "输出语言：简体中文。书名、作者名保留原语言。";
}

/** 清单项推荐理由的写作要求（生成 / 重新生成 / 换一本共用）。 */
export function reasonRules(locale: Locale): string[] {
  if (locale === "en") {
    return [
      "reason: 45–70 words in English, in three parts:",
      "1) Role: where this book sits in the reading sequence, why read it at this point, and how it connects to the books before and after;",
      "2) Author: one sentence on the author's identity, best-known work, or authority in the field;",
      "3) Standing: awards, long-running popularity, a field classic or standard text — only facts you are confident about; if unsure, leave it out, never invent.",
      "Avoid empty phrases such as “very important” or “worth reading”.",
    ];
  }
  return [
    "reason 要求 60-90 字中文，按三部分来写：",
    "1) 角色：这本书在阅读序列里的位置，为什么此时读、与前后项的关系；",
    "2) 作者：一句话介绍作者身份、代表作或在该领域的权威性；",
    "3) 地位：获奖、长期畅销、领域经典或标准教材等，只写有把握的事实，不确定就不写，禁止编造。",
    "禁止「很重要」「值得一读」这类空话。",
  ];
}

/** 阅读路径上的知识点标签要求。 */
export function keyPointRules(locale: Locale): string[] {
  if (locale === "en") {
    return [
      "Requirements:",
      "1) 3 tags per book, 1–3 words each, noun phrases, e.g. “attention residue”, “variable reward”;",
      "2) No book titles, author names or chapter numbers; no empty phrases like “very important”;",
      "3) Only concepts you are confident about; never invent names or figures.",
    ];
  }
  return [
    "要求：",
    "1) 每本书 3 个标签，每个 2–8 个汉字，名词性概念，如「注意力残留」「可变奖励」；",
    "2) 不要书名、作者名、章节序号，不要「很重要」这类空话；",
    "3) 只写有把握的概念，不要编造人名、数据。",
  ];
}

/** 书单市集随机主题的生成要求（不含 system 提示）。 */
export function marketPrompt(locale: Locale, domain: string): string[] {
  if (locale === "en") {
    return [
      `Random field: ${domain}. Choose one specific angle within it.`,
      "Produce: theme name (2–5 words), one-line pitch (8–16 words), theme description (25–50 words: why read it in this order, and what the reader gains).",
      "Then recommend 5–7 books that build up gradually, preferring classics or easily available editions, ordered from easier to harder.",
      "Each book needs a reason in English, 45–70 words, in three parts: 1) where it sits in the sequence and how it connects to its neighbours; 2) the author's identity, best-known work or authority in the field; 3) awards, bestseller status, a field classic or standard text — only facts you are confident about, never invent. Avoid “very important” or “worth reading”.",
      'Output format: {"name":"theme name","tagline":"one-line pitch","description":"theme description","books":[{"title":"book title","author":"author","reason":"recommendation"}]}',
    ];
  }
  return [
    `本次随机领域：${domain}。请在该领域内自选一个具体的切入角度。`,
    "生成：主题名称（4-12 字）、一句话卖点（12-24 字）、主题描述（30-60 字，说明为什么这样读、读完能获得什么）。",
    "再推荐 5-7 本可循序渐进阅读的书，优先经典或易获得的版本，按由浅入深排序。",
    "每本书给 60-90 字中文推荐理由，按三部分来写：1) 它在序列里的位置与前后关系；2) 作者身份、代表作或领域权威性；3) 获奖、畅销、经典或标准教材等，只写有把握的事实，不确定就不写，禁止编造。禁止「很重要」「值得一读」这类空话。",
    '输出格式：{"name":"主题名","tagline":"一句话卖点","description":"主题描述","books":[{"title":"书名","author":"作者","reason":"推荐理由"}]}',
  ];
}
