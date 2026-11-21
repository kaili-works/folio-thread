import { createAdminSupabase } from "./supabase/server";

// 把某个用户清单里的「待补充」候选项，匹配到该用户本人书库内已上传的书（按书名/作者），
// 匹配上的转成 readable。返回匹配结果列表。
// v2 私有书库：只允许在「本人书库 ↔ 本人清单」之间匹配，严禁跨用户扫描。
export async function matchPendingSupplements(userId: string) {
  const admin = createAdminSupabase();

  // 1. 该用户的全部清单
  const { data: lists } = await admin
    .from("reading_lists")
    .select("id")
    .eq("user_id", userId);
  const listIds = (lists ?? []).map((l: { id: string }) => l.id);
  if (listIds.length === 0) return [];

  // 2. 这些清单中的待补充项
  const { data: pendings } = await admin
    .from("list_items")
    .select("id, candidate_metadata")
    .in("reading_list_id", listIds)
    .eq("availability", "pending_supplement")
    .is("deleted_at", null);

  // 3. 该用户本人的书籍
  const { data: docs } = await admin
    .from("documents")
    .select("id, title, author")
    .eq("owner_id", userId);

  const matched: { itemId: string; documentId: string; title: string }[] = [];

  for (const item of (pendings ?? []) as {
    id: string;
    candidate_metadata: { title?: string; author?: string } | null;
  }[]) {
    const title = (item.candidate_metadata?.title ?? "").trim();
    const author = (item.candidate_metadata?.author ?? "").trim();
    if (!title) continue;

    const doc = (docs ?? []).find((d) => {
      const t = (d.title ?? "").trim();
      const a = (d.author ?? "").trim();
      const titleMatch = t === title || t.includes(title) || title.includes(t);
      const authorMatch =
        author && a && (a.includes(author) || author.includes(a));
      return titleMatch || authorMatch;
    });

    if (doc) {
      matched.push({ itemId: item.id, documentId: doc.id, title: doc.title });
    }
  }

  for (const m of matched) {
    await admin
      .from("list_items")
      .update({
        document_id: m.documentId,
        matched_document_id: m.documentId,
        availability: "readable",
      })
      .eq("id", m.itemId);
  }

  return matched;
}
