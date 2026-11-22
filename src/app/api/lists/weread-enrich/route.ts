import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { findWeReadBook } from "@/lib/weread";
import { errorResponse } from "@/lib/api-response";

// 给清单里「待补充」的书补查微信读书，命中后写入阅读链接
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  try {
    await requireUser();
    const body = await request.json();
    const listId = body?.list_id as string | undefined;
    if (!listId) throw new ApiError(400, "缺少清单");

    const { data: items, error } = await supabase
      .from("list_items")
      .select("id, availability, candidate_metadata")
      .eq("reading_list_id", listId)
      .eq("availability", "pending_supplement")
      .is("deleted_at", null);
    if (error) throw new ApiError(500, `读取清单失败：${error.message}`);

    const targets = (items ?? []).filter(
      (it: any) => it.candidate_metadata?.title && !it.candidate_metadata?.weread,
    );

    const hits = await Promise.all(
      targets.map((it: any) =>
        findWeReadBook(it.candidate_metadata.title, it.candidate_metadata.author ?? ""),
      ),
    );

    let updated = 0;
    await Promise.all(
      targets.map(async (it: any, i: number) => {
        const hit = hits[i];
        if (!hit) return;
        const { error: updateErr } = await supabase
          .from("list_items")
          .update({
            candidate_metadata: {
              ...it.candidate_metadata,
              weread: { bookId: hit.bookId, readerLink: hit.readerLink },
            },
          })
          .eq("id", it.id);
        if (!updateErr) updated += 1;
      }),
    );

    return NextResponse.json({ checked: targets.length, updated });
  } catch (e) {
    return errorResponse(e);
  }
}
