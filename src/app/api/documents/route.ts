import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { parseEpub } from "@/lib/epub/parser";
import { matchPendingSupplements } from "@/lib/matching";
import { uploadBookMedia, removeBookFiles } from "@/lib/book-media";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const PARSE_VERSION = 1;
const BUCKET = "shared";

// 书库列表（仅本人书库；RLS + 显式 owner 过滤双重保护）
export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ documents: data });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 上传并解析 EPUB 到本人私有书库（所有登录用户可用）
export async function POST(request: Request) {
  const admin = createAdminSupabase();
  let basePath: string | null = null;
  let docId: string | null = null;

  try {
    const user = await requireUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new ApiError(400, "缺少文件");

    if (!file.name.toLowerCase().endsWith(".epub")) {
      throw new ApiError(400, "仅支持 .epub 文件");
    }
    if (file.size > MAX_SIZE) {
      throw new ApiError(400, "文件超过 50MB 上限");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex");

    // 去重：同一用户重复上传同一文件则跳过；其他用户的同名文件互不影响
    const { data: existing } = await admin
      .from("documents")
      .select("id, title, author, language, total_words_original")
      .eq("owner_id", user.id)
      .eq("file_hash", fileHash)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ document: existing, duplicate: true });
    }

    // 纯程序解析，不调用 LLM
    let book;
    try {
      book = await parseEpub(buffer);
    } catch (e) {
      throw new ApiError(422, `解析失败：${(e as Error).message}`);
    }

    // 1. 写入 documents（必须带 owner_id）
    const { data: doc, error: docErr } = await admin
      .from("documents")
      .insert({
        owner_id: user.id,
        title: book.title,
        author: book.author,
        description: book.description,
        language: book.language,
        file_hash: fileHash,
        parse_version: PARSE_VERSION,
        total_words_original: book.total_words,
      })
      .select()
      .single();

    if (docErr || !doc) {
      throw new ApiError(500, `写入书籍失败：${docErr?.message ?? "未知错误"}`);
    }
    docId = doc.id;
    basePath = `users/${user.id}/${doc.id}`;

    // 2. 上传原始文件到 Storage（私有 bucket，路径含所有者）
    const storagePath = `${basePath}/book.epub`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: "application/epub+zip",
        upsert: true,
      });
    if (upErr) throw new ApiError(500, `文件存储失败：${upErr.message}`);

    await admin
      .from("documents")
      .update({ file_path: storagePath })
      .eq("id", doc.id);

    // 上传封面和正文图片，封面路径写回 cover_url
    const { coverPath, imagePathByKey } = await uploadBookMedia(
      admin,
      BUCKET,
      basePath,
      book,
    );
    if (coverPath) {
      await admin
        .from("documents")
        .update({ cover_url: coverPath })
        .eq("id", doc.id);
    }

    // 3. 批量写入 chapters
    const { data: chapters, error: chErr } = await admin
      .from("chapters")
      .insert(
        book.chapters.map((c) => ({
          document_id: doc.id,
          order_index: c.order_index,
          title: c.title,
          word_count_original: c.word_count,
          depth: c.depth,
        })),
      )
      .select("id, order_index");

    if (chErr || !chapters) {
      throw new ApiError(500, `写入章节失败：${chErr?.message ?? "未知错误"}`);
    }

    // 4. 构造段落并分批写入
    const chapterIdByOrder = new Map(
      chapters.map((c) => [c.order_index, c.id]),
    );

    const paragraphRows = [];
    for (const c of book.chapters) {
      const chapterId = chapterIdByOrder.get(c.order_index);
      for (const p of c.paragraphs) {
        paragraphRows.push({
          chapter_id: chapterId,
          order_index: p.order_index,
          text_original: p.text,
          word_count_original: p.word_count,
          block_type: p.block_type,
          text_html: p.html || null,
          image_path: p.image_key
            ? (imagePathByKey.get(p.image_key) ?? null)
            : null,
        });
      }
    }

    const BATCH = 500;
    for (let i = 0; i < paragraphRows.length; i += BATCH) {
      const { error: pErr } = await admin
        .from("paragraphs")
        .insert(paragraphRows.slice(i, i + BATCH));
      if (pErr) throw new ApiError(500, `写入段落失败：${pErr.message}`);
    }

    // 上传成功后自动匹配本人清单中的待补充候选
    await matchPendingSupplements(user.id);

    return NextResponse.json({
      document: doc,
      chapter_count: book.chapter_count,
      paragraph_count: book.paragraph_count,
    });
  } catch (e) {
    // 失败时清理已写入的数据与 Storage 文件，避免残留半成品
    if (basePath) {
      await removeBookFiles(admin, BUCKET, [basePath]);
    }
    if (docId) {
      await admin.from("documents").delete().eq("id", docId);
    }
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
