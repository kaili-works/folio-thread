import type { Locale } from "@/i18n";

// API 的报错与提示文案一直是中文硬编码，英文界面下会露出来。
// 这里以中文原文为 key 做一层翻译，不动各接口里的业务逻辑。
const EN: Record<string, string> = {
  // 鉴权
  "未登录": "Not signed in",
  "无权访问这本书": "You do not have access to this book",
  "无权访问该清单": "You do not have access to this list",
  "无权翻译不属于自己的书籍": "You cannot translate a book you do not own",

  // 通用校验
  "没有可更新的字段": "No fields to update",
  "参数不完整": "Missing parameters",
  "缺少文件": "File is required",
  "缺少文本": "Text is required",
  "缺少章节": "Chapter is required",
  "缺少段落": "Paragraph is required",
  "缺少主题": "Theme is required",
  "缺少模板": "Template is required",
  "缺少清单": "List is required",
  "缺少清单项": "List item is required",
  "主题名称不能为空": "Theme name cannot be empty",
  "无效的主题状态": "Invalid theme status",
  "无效的领域标签": "Invalid domain",
  "仅支持 .epub 文件": "Only .epub files are supported",
  "文件超过 50MB 上限": "File exceeds the 50 MB limit",
  "阅读速度需在 100~1000 字/分钟之间":
    "Reading speed must be between 100 and 1000 characters per minute",
  "上报时长超出上限": "Reported duration exceeds the limit",

  // 资源不存在
  "书籍不存在": "Book not found",
  "章节不存在": "Chapter not found",
  "段落不存在": "Paragraph not found",
  "主题不存在": "Theme not found",
  "清单不存在": "List not found",
  "清单项不存在": "List item not found",
  "笔记不存在": "Note not found",
  "模板不存在": "Template not found",
  "今天还没有每日包": "No reading pack for today yet",
  "该条目不是微信读书书目": "This item is not a WeRead book",

  // 限流
  "生成书单过于频繁，请稍后再试": "Too many list generations. Please try again later.",
  "重新生成过于频繁，请稍后再试": "Too many regenerations. Please try again later.",
  "换一本过于频繁，请稍后再试": "Too many swaps. Please try again later.",
  "重写理由过于频繁，请稍后再试":
    "Too many reason rewrites. Please try again later.",
  "操作过于频繁，请稍后再试": "Too many requests. Please try again later.",
  "提炼过于频繁，请稍后再试": "Too many extraction requests. Please try again later.",
  "分类请求过于频繁，请稍后再试":
    "Too many classification requests. Please try again later.",
  "翻译请求过于频繁，请稍后再试":
    "Too many translation requests. Please try again later.",
  "语音请求过于频繁，请稍后再试":
    "Too many speech requests. Please try again later.",

  // AI 相关
  "未配置 AI_API_KEY 或 DEEPSEEK_API_KEY":
    "AI_API_KEY or DEEPSEEK_API_KEY is not configured",
  "未配置 AI_API_KEY 或 DEEPSEEK_API_KEY（见 README 的 AI 配置）":
    "AI_API_KEY or DEEPSEEK_API_KEY is not configured (see the AI setup in README)",
  "未配置 AI_API_KEY 或 DEEPSEEK_API_KEY，无法生成清单（见 README 的 AI 配置）":
    "AI_API_KEY or DEEPSEEK_API_KEY is not configured, so no list can be generated (see the AI setup in README)",
  "未配置 AI_API_KEY 或 DEEPSEEK_API_KEY，无法重新生成清单（见 README 的 AI 配置）":
    "AI_API_KEY or DEEPSEEK_API_KEY is not configured, so the list cannot be regenerated (see the AI setup in README)",
  "AI 返回为空": "AI returned an empty response",
  "未配置 DEEPSEEK_API_KEY": "DEEPSEEK_API_KEY is not configured",
  "未配置 DEEPSEEK_API_KEY（见 README 的 AI 配置）":
    "DEEPSEEK_API_KEY is not configured (see the AI setup in README)",
  "未配置 DEEPSEEK_API_KEY，无法生成清单（见 README 的 AI 配置）":
    "DEEPSEEK_API_KEY is not configured, so no list can be generated (see the AI setup in README)",
  "未配置 DEEPSEEK_API_KEY，无法重新生成清单（见 README 的 AI 配置）":
    "DEEPSEEK_API_KEY is not configured, so the list cannot be regenerated (see the AI setup in README)",
  "AI 生成失败，请稍后重试": "AI generation failed. Please try again later.",
  "AI 生成失败：返回为空": "AI generation failed: empty response",
  "AI 生成失败：返回格式异常": "AI generation failed: unexpected response format",
  "AI 生成失败：主题或书目为空，请重试":
    "AI generation failed: theme or books came back empty, please retry",
  "语音合成结果为空": "Speech synthesis returned nothing",
  "生成的清单缺少主题名称": "The generated list has no theme name",
  "生成的清单没有书目": "The generated list has no books",
  "清单项缺少书名": "The list item has no book title",
  "还没有清单，先点「生成清单」": "No list yet — generate one first",

  // 动态消息的前缀（「前缀：详情」写法）
  "AI 请求失败：": "AI request failed: ",
  "AI 生成失败：": "AI generation failed: ",
  "创建主题失败：": "Failed to create theme: ",
  "创建清单失败：": "Failed to create list: ",
  "写入清单项失败：": "Failed to write list item: ",
  "写入新项失败：": "Failed to write new items: ",
  "更新失败：": "Update failed: ",
  "删除失败：": "Delete failed: ",
  "删除新项失败：": "Failed to delete new items: ",
  "删除旧项失败：": "Failed to delete old items: ",
  "恢复旧项失败：": "Failed to restore old items: ",
  "换书失败：": "Failed to swap book: ",
  "更新理由失败：": "Failed to update the reason: ",
  "保存笔记失败：": "Failed to save note: ",
  "保存阅读速度失败：": "Failed to save reading speed: ",
  "读取清单失败：": "Failed to load list: ",
  "清理书库失败：": "Failed to clear library: ",
  "删除账号失败：": "Failed to delete account: ",
  "解析失败：": "Failed to parse: ",
  "写入书籍失败：": "Failed to save book: ",
  "写入章节失败：": "Failed to save chapters: ",
  "写入段落失败：": "Failed to save paragraphs: ",
  "写入进度失败：": "Failed to save progress: ",
  "写入阅读时长失败：": "Failed to save reading time: ",
  "读取阅读时长失败：": "Failed to load reading time: ",
  "文件存储失败：": "Failed to store file: ",
  "未知错误": "unknown error",
};

/**
 * 把接口里的中文提示翻成当前界面语言。
 * 精确命中优先；否则按「前缀：详情」拆开翻译前缀，详情（多为 Supabase 报错）保持原样。
 */
export function tApi(locale: Locale, message: string): string {
  if (locale === "zh") return message;

  const exact = EN[message];
  if (exact) return exact;

  const cut = message.indexOf("：");
  if (cut > 0) {
    const prefix = EN[message.slice(0, cut + 1)];
    if (prefix) return prefix + message.slice(cut + 1);
  }
  return message;
}
