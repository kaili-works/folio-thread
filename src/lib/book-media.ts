import type { ParsedBook } from "./epub/parser";

export const STORAGE_BUCKET = "shared";

// 把封面和正文图片上传到 Storage，返回封面路径与「图片 key → 路径」映射。
// basePath 是书籍在 bucket 内的目录前缀，例如 users/{user_id}/{document_id}。
// client 传入 Supabase 客户端（route 用 admin，脚本用自己的 service_role 客户端）。
export async function uploadBookMedia(
  client: { storage: { from: (bucket: string) => any } },
  bucket: string,
  basePath: string,
  book: ParsedBook,
): Promise<{ coverPath: string | null; imagePathByKey: Map<string, string> }> {
  let coverPath: string | null = null;
  if (book.cover) {
    const p = `${basePath}/cover${book.cover.ext}`;
    const { error } = await client.storage.from(bucket).upload(p, book.cover.data, {
      contentType: book.cover.mediaType,
      upsert: true,
    });
    if (error) throw new Error(`封面上传失败：${error.message}`);
    coverPath = p;
  }

  const imagePathByKey = new Map<string, string>();
  for (const img of book.images) {
    const p = `${basePath}/images/${img.key}${img.ext}`;
    const { error } = await client.storage.from(bucket).upload(p, img.data, {
      contentType: img.mediaType,
      upsert: true,
    });
    if (error) throw new Error(`图片上传失败：${error.message}`);
    imagePathByKey.set(img.key, p);
  }

  return { coverPath, imagePathByKey };
}

// 删除一本书在 Storage 内的所有文件（含 images/ 子目录）。
// 传入多个 basePath 可同时清理新路径（users/{uid}/{docId}）与历史路径（{docId}）。
export async function removeBookFiles(
  client: { storage: { from: (bucket: string) => any } },
  bucket: string,
  basePaths: string[],
) {
  const paths: string[] = [];
  for (const base of basePaths) {
    for (const dir of [base, `${base}/images`]) {
      const { data } = await client.storage.from(bucket).list(dir, { limit: 100 });
      for (const f of data ?? []) {
        // id 为 null 表示子目录，跳过（子目录在上层循环中单独处理）
        if (!f.id) continue;
        paths.push(`${dir}/${f.name}`);
      }
    }
  }
  if (paths.length > 0) await client.storage.from(bucket).remove(paths);
}
