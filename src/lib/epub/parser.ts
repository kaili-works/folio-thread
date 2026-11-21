import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

// 纯程序解析，不调用任何 LLM。
const xml = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

export interface ParsedImage {
  key: string;
  src: string;
  data: Buffer;
  mediaType: string;
  ext: string;
}

export interface ParsedParagraph {
  order_index: number;
  text: string;
  word_count: number;
  // 语义块类型：p / h1 / h2 / h3 / h4 / li / blockquote / pre / hr / image
  block_type: string;
  // 白名单清洗后的内联 HTML（仅展示用；pre/hr/image 为空）
  html: string;
  // 图片段：非空表示这是一张图，指向 book.images 里 key 相同的图片
  image_key?: string;
}

export interface ParsedChapter {
  order_index: number;
  title: string;
  word_count: number;
  paragraphs: ParsedParagraph[];
  depth: number;
}

export interface ParsedBook {
  title: string;
  author: string;
  language: string;
  description: string;
  chapter_count: number;
  paragraph_count: number;
  total_words: number;
  chapters: ParsedChapter[];
  cover: ParsedImage | null;
  images: ParsedImage[];
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// 递归提取节点内的纯文本（用于标题/元数据）
function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object") {
    let out = "";
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "#text") out += String(v);
      else if (k.startsWith("@_") || k.startsWith("?")) continue;
      else out += textOf(v);
    }
    return out;
  }
  return "";
}

function firstText(node: unknown): string {
  for (const item of toArray(node)) {
    const t = textOf(item).trim();
    if (t) return t;
  }
  return "";
}

function isChineseLang(lang: string): boolean {
  return (lang || "").toLowerCase().startsWith("zh");
}

// 字数口径：中文按字数（去空白），非中文按词数（按空格分词）
function countWords(text: string, chinese: boolean): number {
  const t = text.trim();
  if (!t) return 0;
  if (chinese) return t.replace(/\s+/g, "").length;
  return t.split(/\s+/).length;
}

// 规范化路径：去锚点、去 ./ 前缀、URL 解码
function normalizePath(p: string): string {
  let s = p;
  try {
    s = decodeURIComponent(s);
  } catch {
    // 保留原样
  }
  return s.split("#")[0].replace(/^\.\//, "");
}

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i + 1) : "";
}

// 组合基准目录 + 相对路径，解码并归一化 ../ 和 ./
function resolvePath(base: string, href: string): string {
  let s = base + href;
  try {
    s = decodeURIComponent(s);
  } catch {
    // 保留原样
  }
  const out: string[] = [];
  for (const part of s.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function guessMediaType(path: string): string {
  const p = path.toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function extForMediaType(mt: string): string {
  switch (mt) {
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    case "image/webp":
      return ".webp";
    default:
      return ".jpg";
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

// 白名单清洗内联 HTML：只保留 b/strong/i/em/u/a（a 只留 href），其余标签丢弃、保留文本。
function sanitizeInlineHtml(html: string): string {
  if (!html) return "";
  let s = html
    .replace(/<(script|style|iframe)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const ALLOW = new Set(["b", "strong", "i", "em", "u", "a"]);
  s = s.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
    (full, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      const isClose = full.startsWith("</");
      if (!ALLOW.has(t)) return "";
      if (isClose) return `</${t}>`;
      if (t === "a") {
        const href = /href\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
        if (href && /^(https?:\/\/|#|\/)/i.test(href)) {
          return `<a href="${href.replace(/"/g, "&quot;")}">`;
        }
        return "";
      }
      return `<${t}>`;
    },
  );

  // 兜底：移除残留的事件属性
  return s.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
}

// 从内联 HTML 提取纯文本（实体解码 + 去标签）
function textOfHtml(html: string): string {
  let s = html.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  return s.replace(/\s+/g, " ").trim();
}

type ContentBlock =
  | { type: "block"; tag: string; html: string; text: string }
  | { type: "image"; src: string };

// 按文档顺序提取语义块：标题/段落/列表项/引用/代码块/分隔线/图片。
function extractBlocks(xhtmlStr: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const re =
    /<(h[1-6]|p|blockquote|pre|li)\b[^>]*>([\s\S]*?)<\/\1>|<(hr)\b[^>]*>|<img\b[^>]*src=["']([^"']+)["'][^>]*\/?>|<image\b[^>]*(?:xlink:href|href)=["']([^"']+)["'][^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xhtmlStr)) !== null) {
    if (m[1]) {
      const tag = m[1].toLowerCase();
      const inner = m[2];
      const text = textOfHtml(inner);
      if (tag === "pre") {
        if (text) blocks.push({ type: "block", tag, html: "", text });
      } else {
        const html = sanitizeInlineHtml(inner);
        if (text || html) blocks.push({ type: "block", tag, html, text });
      }
    } else if (m[3]) {
      blocks.push({ type: "block", tag: "hr", html: "", text: "" });
    } else if (m[4] || m[5]) {
      blocks.push({ type: "image", src: normalizePath(m[4] ?? m[5]) });
    }
  }
  return blocks;
}

// 从单个 XHTML 提取章节标题 + 有序语义块
function extractChapterContent(xhtmlStr: string): {
  title: string;
  blocks: ContentBlock[];
} {
  let parsed: any;
  try {
    parsed = xml.parse(xhtmlStr);
  } catch {
    return { title: "", blocks: [] };
  }

  const headings: string[] = [];

  const walk = (node: unknown): void => {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "h1" || k === "h2" || k === "h3") {
        const t = textOf(v).trim();
        if (t) headings.push(t);
      } else {
        walk(v);
      }
    }
  };

  walk(parsed);

  let heading = "";
  for (const h of headings) {
    if (!/^\d+$/.test(h) && h.length > 1) {
      heading = h;
      break;
    }
  }
  if (!heading && headings.length > 0) heading = headings[0];

  // 注意：不把 <title> 当章节标题（<title> 通常是整本书名，不是本章标题）
  return { title: heading, blocks: extractBlocks(xhtmlStr) };
}

type TocEntry = { title: string; depth: number };

// 从 TOC（NAV 或 NCX）解析目录，返回「规范化 href → 标题+层级」映射
async function parseToc(
  zip: JSZip,
  pkg: any,
  opfDir: string,
): Promise<Map<string, TocEntry>> {
  const map = new Map<string, TocEntry>();
  const items = toArray(pkg.manifest?.item);

  // EPUB3：NAV（manifest 里 properties 含 nav）——先按扁平处理（depth 0）
  const navItem = items.find(
    (it) =>
      typeof it?.["@_properties"] === "string" &&
      it["@_properties"].includes("nav"),
  );
  if (navItem?.["@_href"]) {
    const navStr = await zip
      .file(decodeURIComponent(opfDir + navItem["@_href"]))
      ?.async("string");
    if (navStr) {
      const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRegex.exec(navStr)) !== null) {
        const href = normalizePath(m[1]);
        const title = m[2].replace(/<[^>]+>/g, "").trim();
        if (href && title && !map.has(href)) map.set(href, { title, depth: 0 });
      }
    }
  }

  // EPUB2：NCX（media-type application/x-dtbncx+xml），递归 navPoint 带层级
  const ncxItem = items.find(
    (it) => it?.["@_media-type"] === "application/x-dtbncx+xml",
  );
  if (ncxItem?.["@_href"]) {
    const ncxStr = await zip
      .file(decodeURIComponent(opfDir + ncxItem["@_href"]))
      ?.async("string");
    if (ncxStr) {
      let ncx: any;
      try {
        ncx = xml.parse(ncxStr);
      } catch {
        ncx = null;
      }
      if (ncx) {
        const collect = (npList: any, depth: number) => {
          for (const np of toArray(npList)) {
            const title = firstText(np?.navLabel?.text);
            const src = np?.content?.["@_src"] as string | undefined;
            if (title && src) {
              const key = normalizePath(src);
              if (!map.has(key)) map.set(key, { title, depth });
            }
            collect(np?.navPoint, depth + 1);
          }
        };
        collect(ncx?.ncx?.navMap?.navPoint, 0);
      }
    }
  }

  return map;
}

export async function parseEpub(buffer: ArrayBuffer | Buffer): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(buffer);

  // 1. 定位 OPF 文件路径
  const containerStr = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerStr) throw new Error("无效的 EPUB：缺少 META-INF/container.xml");

  let container: any;
  try {
    container = xml.parse(containerStr);
  } catch {
    throw new Error("无效的 EPUB：container.xml 无法解析");
  }

  const rootfile = toArray(container?.container?.rootfiles?.rootfile)[0];
  const opfPath = rootfile?.["@_full-path"] as string | undefined;
  if (!opfPath) throw new Error("无效的 EPUB：container.xml 缺少 rootfile");

  // 2. 解析 OPF（metadata + manifest + spine）
  const opfStr = await zip.file(opfPath)?.async("string");
  if (!opfStr) throw new Error("无效的 EPUB：找不到 OPF 文件");

  let pkg: any;
  try {
    pkg = xml.parse(opfStr)?.package;
  } catch {
    throw new Error("无效的 EPUB：OPF 无法解析");
  }
  if (!pkg) throw new Error("无效的 EPUB：OPF 缺少 package 节点");

  const meta = pkg.metadata ?? {};
  const title = firstText(meta.title) || "未命名书籍";
  const author = firstText(meta.creator) || "";
  const language = firstText(meta.language) || "unknown";
  const description = firstText(meta.description) || "";

  // manifest：id -> href，并标记目录页（nav）用于跳过
  const idToHref = new Map<string, string>();
  const navHrefs = new Set<string>();
  for (const item of toArray(pkg.manifest?.item)) {
    const id = item?.["@_id"] as string | undefined;
    const href = item?.["@_href"] as string | undefined;
    if (id && href) idToHref.set(id, href);
    const props = item?.["@_properties"];
    if (typeof props === "string" && props.includes("nav") && href) {
      navHrefs.add(normalizePath(href));
    }
  }

  // OPF 所在目录（href 相对它）
  const opfDir = dirname(opfPath);

  // 解析目录（TOC），用于补全章节标题
  const tocMap = await parseToc(zip, pkg, opfDir);

  // 读一张图片（base 是解析基准目录）
  async function readImage(
    base: string,
    src: string,
  ): Promise<{ data: Buffer; mediaType: string; ext: string } | null> {
    const fullPath = resolvePath(base, src);
    const file = zip.file(fullPath);
    if (!file) return null;
    const data = (await file.async("nodebuffer")) as Buffer;
    const mediaType = guessMediaType(fullPath);
    return { data, mediaType, ext: extForMediaType(mediaType) };
  }

  // 封面：EPUB3 properties=cover-image / EPUB2 meta[name=cover] / guide reference
  async function findCover(): Promise<ParsedImage | null> {
    const items = toArray(pkg.manifest?.item);
    let coverHref: string | undefined;

    const coverImageItem = items.find(
      (it) =>
        typeof it?.["@_properties"] === "string" &&
        it["@_properties"].split(/\s+/).includes("cover-image"),
    );
    coverHref = coverImageItem?.["@_href"];

    if (!coverHref) {
      const coverMeta = toArray(meta.meta).find(
        (m) => (m?.["@_name"] ?? "").toLowerCase() === "cover",
      );
      const coverId = coverMeta?.["@_content"] as string | undefined;
      if (coverId) {
        coverHref = items.find((it) => it?.["@_id"] === coverId)?.["@_href"];
      }
    }

    if (!coverHref) {
      coverHref = toArray(pkg.guide?.reference).find(
        (r) => (r?.["@_type"] ?? "").toLowerCase() === "cover",
      )?.["@_href"];
    }

    if (!coverHref) return null;
    const img = await readImage(opfDir, coverHref);
    if (!img) return null;
    return { key: "cover", src: coverHref, ...img };
  }

  const cover = await findCover();

  // 正文图片：按规范化 src 去重，共享同一份二进制
  const images: ParsedImage[] = [];
  const imageBySrc = new Map<string, ParsedImage>();
  async function ensureImage(
    base: string,
    src: string,
  ): Promise<ParsedImage | null> {
    const norm = normalizePath(src);
    const existing = imageBySrc.get(norm);
    if (existing) return existing;
    const img = await readImage(base, src);
    if (!img) return null;
    const parsed: ParsedImage = {
      key: `img-${images.length + 1}`,
      src,
      ...img,
    };
    images.push(parsed);
    imageBySrc.set(norm, parsed);
    return parsed;
  }

  // 3. 按 spine 顺序逐章解析
  const chinese = isChineseLang(language);
  const chapters: ParsedChapter[] = [];

  for (const ref of toArray(pkg.spine?.itemref)) {
    const idref = ref?.["@_idref"] as string | undefined;
    const href = idref ? idToHref.get(idref) : undefined;
    if (!href) continue;

    // 跳过目录页（nav.xhtml）——它不是正文章节
    if (navHrefs.has(normalizePath(href))) continue;

    const fullPath = decodeURIComponent(opfDir + href);
    const xhtmlStr = await zip.file(fullPath)?.async("string");
    if (xhtmlStr == null) continue;

    const { title: chapterTitle, blocks } = extractChapterContent(xhtmlStr);
    if (blocks.length === 0) continue;

    const toc = tocMap.get(normalizePath(href));
    const tocTitle = toc?.title;
    const depth = toc?.depth ?? 0;
    const finalTitle = tocTitle || chapterTitle;

    // 该章图片相对 XHTML 文件所在目录解析
    const chapterBase = dirname(fullPath);

    const paragraphs: ParsedParagraph[] = [];
    const norm = (s: string) => (s ?? "").trim().replace(/\s+/g, "");

    let skippedTitle = false;
    let seenBody = false;
    let order = 0;
    for (const b of blocks) {
      if (b.type === "image") {
        const img = await ensureImage(chapterBase, b.src);
        if (img) {
          order += 1;
          paragraphs.push({
            order_index: order,
            text: "",
            word_count: 0,
            block_type: "image",
            html: "",
            image_key: img.key,
          });
        }
        continue;
      }

      const text = b.text;
      const isHeading = /^h[1-6]$/.test(b.tag);

      // 跳过与章节标题重复的开头标题（正文内容出现之前），避免标题显示两次
      if (!skippedTitle && !seenBody && isHeading) {
        const n = norm(text);
        if (n && (n === norm(finalTitle) || n === norm(chapterTitle))) {
          skippedTitle = true;
          continue;
        }
      }

      if (!isHeading) seenBody = true;

      order += 1;
      paragraphs.push({
        order_index: order,
        text,
        word_count: countWords(text, chinese),
        block_type: b.tag,
        html: b.html,
      });
    }

    if (paragraphs.length === 0) continue;

    const word_count = paragraphs.reduce((s, p) => s + p.word_count, 0);

    // 纯图片章（如封面页）给个友好标题
    let title = finalTitle;
    if (!tocTitle) {
      const hasText = paragraphs.some(
        (p) => p.block_type !== "image" && p.text.trim(),
      );
      if (!hasText) {
        title = chapters.length === 0 ? "封面" : "插图";
      }
    }

    chapters.push({
      order_index: chapters.length + 1,
      title,
      word_count,
      paragraphs,
      depth,
    });
  }

  if (chapters.length === 0) {
    throw new Error("解析失败：未在 EPUB 中提取到任何章节或段落");
  }

  const paragraph_count = chapters.reduce((s, c) => s + c.paragraphs.length, 0);
  const total_words = chapters.reduce((s, c) => s + c.word_count, 0);

  return {
    title,
    author,
    language,
    description,
    chapter_count: chapters.length,
    paragraph_count,
    total_words,
    chapters,
    cover,
    images,
  };
}
