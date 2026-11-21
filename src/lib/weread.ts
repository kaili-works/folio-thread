import { getWeReadKey } from "@/lib/config";

const GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = process.env.WEREAD_SKILL_VERSION ?? "1.0.5";

export type WeReadBook = {
  bookId: string;
  title: string;
  author: string;
  readerLink: string;
};

// 去掉书名号、括号注释和标点，便于跨平台比对书名/作者
function normalize(value: string) {
  return value
    .replace(/[《》「」【】]/g, "")
    .replace(/[\[\(（].*?[\]\)）]/g, "")
    .replace(/[\s:：,，.。·\-—_/]/g, "")
    .toLowerCase();
}

async function callGateway(
  apiName: string,
  params: Record<string, unknown>,
): Promise<any | null> {
  const key = await getWeReadKey();
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ api_name: apiName, ...params, skill_version: SKILL_VERSION }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.errcode && data.errcode !== 0) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 在微信读书书城搜一本书，返回可用阅读链接；未配置 key、失败或未命中都返回 null
export async function findWeReadBook(
  title: string,
  author?: string,
): Promise<WeReadBook | null> {
  if (!title.trim()) return null;

  const data = await callGateway("/store/search", {
    keyword: title.trim(),
    scope: 10,
    count: 5,
  });
  if (!data) return null;

  const books: any[] = [];
  for (const group of data.results ?? []) {
    if (Array.isArray(group?.books)) books.push(...group.books);
  }
  const infos = books
    .map((b) => b?.bookInfo)
    .filter((b) => b?.bookId && b?.readerLink && !b?.soldout);
  if (infos.length === 0) return null;

  const wantTitle = normalize(title);
  const wantAuthor = author ? normalize(author) : "";

  const exact = infos.find((b) => normalize(b.title ?? "") === wantTitle);
  const loose = infos.find((b) => {
    const t = normalize(b.title ?? "");
    const titleOk = t.includes(wantTitle) || wantTitle.includes(t);
    if (!titleOk) return false;
    if (!wantAuthor) return Math.abs(t.length - wantTitle.length) <= 4;
    const a = normalize(b.author ?? "");
    return a.includes(wantAuthor) || wantAuthor.includes(a);
  });

  const hit = exact ?? loose;
  if (!hit) return null;

  return {
    bookId: String(hit.bookId),
    title: hit.title ?? title,
    author: hit.author ?? author ?? "",
    readerLink: hit.readerLink,
  };
}

// 读取一本书在微信读书里的阅读状态：
// readingSeconds 是这本书的累计阅读秒数（用于折算今日阅读量），
// bookProgress 是全书百分比（只用来判断是否读完整本，未开读时为 null）
export type WeReadProgress = {
  readingSeconds: number;
  bookProgress: number | null;
  finished: boolean;
};

export async function getWeReadProgress(
  bookId: string,
): Promise<WeReadProgress | null> {
  if (!bookId) return null;
  const data = await callGateway("/book/getprogress", { bookId });
  const book = data?.book;
  if (!book) return null;
  const readingSeconds =
    typeof book.readingTime === "number" && book.readingTime > 0
      ? book.readingTime
      : 0;
  const bookProgress =
    typeof book.progress === "number" ? book.progress : null;
  return {
    readingSeconds,
    bookProgress,
    finished: bookProgress !== null && bookProgress >= 100,
  };
}

// 今日进度 = (当前累计时长 - 今日起始基线) / 今日计划时长，封顶 100
export function wereadTodayPct(
  readingSeconds: number,
  baselineSeconds: number,
  plannedMinutes: number,
): number {
  const target = Math.max(1, plannedMinutes) * 60;
  const delta = Math.max(0, readingSeconds - baselineSeconds);
  return Math.min(100, Math.round((delta / target) * 100));
}
