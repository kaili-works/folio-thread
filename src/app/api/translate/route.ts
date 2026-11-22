import { NextResponse } from "next/server";
import {
  createAdminSupabase,
  createServerSupabase,
} from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  contentHash,
  translateText,
  translateVersion,
} from "@/lib/translate";
import { getRequestLocale } from "@/lib/request-locale";
import { errorResponse } from "@/lib/api-response";
import { tApi } from "@/lib/api-messages";

const CONCURRENCY = 5;
// 单次请求的段落上限：避免一个请求被放大成上千次上游调用
const MAX_PARAGRAPHS = 40;
// 失败段落的冷却时间：上游故障时不要在每次翻页都重复计费
const FAILED_TTL_MS = 5 * 60 * 1000;
// 「段落:内容哈希」→ 解禁时间戳（进程内，重启失效）
const failedUntil = new Map<string, number>();

// 翻译一组段落（按 paragraph_id）。命中缓存直接复用，缺失的并发翻译并写缓存。
// v2 私有书库：段落必须属于当前用户自己的书，否则拒绝。
export async function POST(request: Request) {
  const admin = createAdminSupabase();
  try {
    const user = await requireUser();
    // 前端按 40 段分批，长章节会产生多次请求，故额度放宽到 20 次/分
    if (!rateLimit(`translate:${user.id}`, 20, 60_000)) {
      return NextResponse.json(
        { error: tApi(await getRequestLocale(), "翻译请求过于频繁，请稍后再试") },
        { status: 429 },
      );
    }

    const body = await request.json();
    const rawIds: string[] = body?.paragraphIds ?? [];
    // 译文语言跟随界面语言，同时决定用哪一份缓存
    const locale = await getRequestLocale();
    const modelVersion = translateVersion(locale);
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ error: tApi(await getRequestLocale(), "缺少段落") }, { status: 400 });
    }
    const paragraphIds = [
      ...new Set(rawIds.filter((id) => typeof id === "string" && id.length > 0)),
    ];
    if (paragraphIds.length > MAX_PARAGRAPHS) {
      return NextResponse.json(
        { error: `单次最多翻译 ${MAX_PARAGRAPHS} 段` },
        { status: 400 },
      );
    }

    // 1. 查原文（用户 JWT + RLS，只有自己的书能读到；少一条即视为越权）
    const userClient = await createServerSupabase();
    const { data: paragraphs, error } = await userClient
      .from("paragraphs")
      .select("id, text_original")
      .in("id", paragraphIds);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if ((paragraphs ?? []).length !== paragraphIds.length) {
      throw new ApiError(403, "无权翻译不属于自己的书籍");
    }

    const rows = (paragraphs ?? []) as {
      id: string;
      text_original: string | null;
    }[];

    // 2. 查已有缓存
    const hashById = new Map<string, string>();
    const emptyIds = new Set<string>();
    for (const p of rows) {
      hashById.set(p.id, contentHash(p.text_original ?? ""));
      // 空段落不翻译，直接返回空字符串（图片段、空白块）
      if (!(p.text_original ?? "").trim()) emptyIds.add(p.id);
    }

    const { data: cached } = await admin
      .from("translations")
      .select("paragraph_id, content_hash, text_translated")
      .in("paragraph_id", paragraphIds)
      .eq("model_version", modelVersion)
      .eq("status", "done");

    const cacheMap = new Map<string, string>();
    for (const c of (cached ?? []) as {
      paragraph_id: string;
      content_hash: string;
      text_translated: string | null;
    }[]) {
      if (
        !emptyIds.has(c.paragraph_id) &&
        c.content_hash === hashById.get(c.paragraph_id) &&
        c.text_translated
      ) {
        cacheMap.set(c.paragraph_id, c.text_translated);
      }
    }

    // 本次请求中翻译失败、回退原文的段落，前端据此提示「已显示原文」
    const failedIds = new Set<string>();

    // 3. 需要翻译的段落（排除空段落、已命中缓存的段落）
    const now = Date.now();
    const pending = rows.filter((p) => {
      if (cacheMap.has(p.id) || emptyIds.has(p.id)) return false;
      const until = failedUntil.get(`${p.id}:${hashById.get(p.id)}`);
      if (until && until > now) {
        // 冷却期内不再请求上游，但仍要告诉前端这段是原文
        failedIds.add(p.id);
        return false;
      }
      return true;
    });

    // 4. 并发翻译（失败重试 1 次，仍失败标 failed 并回退原文）
    const resultMap = new Map<string, string>();
    const queue = [...pending];

    const worker = async () => {
      while (queue.length > 0) {
        const p = queue.shift()!;
        const hash = hashById.get(p.id)!;
        let translated: string | null = null;

        for (let attempt = 0; attempt < 2 && translated == null; attempt++) {
          try {
            translated = await translateText(p.text_original ?? "", locale);
          } catch (err) {
            // 只对限流、5xx 与网络错误重试；4xx（如 key 失效）重试只是白花一次钱
            const status = Number(
              /HTTP (\d+)/.exec((err as Error).message ?? "")?.[1] ?? 0,
            );
            const retryable = status === 0 || status === 429 || status >= 500;
            if (!retryable) break;
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }

        const failedKey = `${p.id}:${hash}`;
        if (translated != null) {
          failedUntil.delete(failedKey);
          resultMap.set(p.id, translated);
          await admin.from("translations").upsert(
            {
              paragraph_id: p.id,
              content_hash: hash,
              model_version: modelVersion,
              text_translated: translated,
              status: "done",
            },
            { onConflict: "paragraph_id,content_hash,model_version" },
          );
        } else {
          failedUntil.set(failedKey, Date.now() + FAILED_TTL_MS);
          failedIds.add(p.id);
          resultMap.set(p.id, p.text_original ?? "");
          await admin.from("translations").upsert(
            {
              paragraph_id: p.id,
              content_hash: hash,
              model_version: modelVersion,
              text_translated: null,
              status: "failed",
            },
            { onConflict: "paragraph_id,content_hash,model_version" },
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker),
    );

    // 5. 返回所有段落的译文（缓存 + 新翻译 + 失败回退原文；空段落返回空）
    const translations: Record<string, string> = {};
    for (const p of rows) {
      translations[p.id] = emptyIds.has(p.id)
        ? ""
        : (cacheMap.get(p.id) ?? resultMap.get(p.id) ?? p.text_original ?? "");
    }

    // failed 只回传本次请求中翻译失败、已回退原文的段落，供前端提示
    return NextResponse.json({
      translations,
      failed: rows.filter((p) => failedIds.has(p.id)).map((p) => p.id),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
