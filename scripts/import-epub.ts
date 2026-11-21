import { readdir, readFile, mkdir, rename } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { parseEpub } from "../src/lib/epub/parser";
import { uploadBookMedia, STORAGE_BUCKET } from "../src/lib/book-media";

const BUCKET = STORAGE_BUCKET;
const PARSE_VERSION = 1;

// 独立脚本不会自动加载 .env，这里手动读一下
try {
  const envContent = readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch {
  // 没有 .env 就忽略，改用系统环境变量
}

async function main() {
  const dir = process.argv[2];
  const ownerId = process.argv[3] || process.env.IMPORT_OWNER_ID;
  if (!dir) {
    console.error("用法: npm run import -- <目录路径> <owner_user_id>");
    console.error('例如: npm run import -- "D:\\books" 3f2a...');
    console.error("owner_user_id 为书籍归属账号（Supabase Auth 用户 id）");
    process.exit(1);
  }
  if (!ownerId) {
    console.error("缺少 owner_user_id：第二参数或环境变量 IMPORT_OWNER_ID");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "请在 .env 里配置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const files = (await readdir(dir)).filter((f) =>
    f.toLowerCase().endsWith(".epub"),
  );
  console.log(`找到 ${files.length} 本 EPUB\n`);

  let ok = 0;
  let fail = 0;
  let dup = 0;

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const buffer = await readFile(filePath);
      const fileHash = createHash("sha256").update(buffer).digest("hex");

      // 去重：同一所有者同一文件已入库则跳过（不同账号互不影响）
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("file_hash", fileHash)
        .limit(1)
        .maybeSingle();
      if (existing) {
        dup++;
        console.log(`⏭️ ${file} 已存在，跳过`);
        continue;
      }

      const book = await parseEpub(buffer);

      const { data: doc, error: docErr } = await supabase
        .from("documents")
        .insert({
          owner_id: ownerId,
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
      if (docErr || !doc) throw docErr ?? new Error("写入 documents 失败");

      const basePath = `users/${ownerId}/${doc.id}`;
      const storagePath = `${basePath}/book.epub`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: "application/epub+zip",
          upsert: true,
        });
      if (upErr) throw upErr;
      await supabase
        .from("documents")
        .update({ file_path: storagePath })
        .eq("id", doc.id);

      const { coverPath, imagePathByKey } = await uploadBookMedia(
        supabase,
        BUCKET,
        basePath,
        book,
      );
      if (coverPath) {
        await supabase
          .from("documents")
          .update({ cover_url: coverPath })
          .eq("id", doc.id);
      }

      const { data: chapters, error: chErr } = await supabase
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
      if (chErr || !chapters) throw chErr ?? new Error("写入 chapters 失败");

      const chapterIdByOrder = new Map(
        chapters.map((c) => [c.order_index, c.id]),
      );
      const rows = [];
      for (const c of book.chapters) {
        const cid = chapterIdByOrder.get(c.order_index);
        for (const p of c.paragraphs) {
          rows.push({
            chapter_id: cid,
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
      for (let i = 0; i < rows.length; i += 500) {
        const { error: pErr } = await supabase
          .from("paragraphs")
          .insert(rows.slice(i, i + 500));
        if (pErr) throw pErr;
      }

      // 归档：成功后移入 done/ 子目录，避免下次重复扫描
      const doneDir = join(dir, "done");
      await mkdir(doneDir, { recursive: true });
      await rename(filePath, join(doneDir, file));

      ok++;
      console.log(
        `✅ ${file} → 《${book.title}》 ${book.chapter_count} 章 / ${book.paragraph_count} 段`,
      );
    } catch (e: any) {
      fail++;
      console.error(`❌ ${file} 失败: ${e?.message ?? e}`);
    }
  }

  console.log(`\n完成：成功 ${ok} 本，失败 ${fail} 本，跳过重复 ${dup} 本`);
}

main();
