import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

const BUCKET = "shared";

// 从 Storage 路径中解析出所属 document_id。
// 新路径：users/{user_id}/{document_id}/...
// 历史路径：{document_id}/...
// 新路径的第二段必须是当前用户本人，否则视为非法路径。
function extractDocumentId(path: string, userId: string): string | null {
  if (path.includes("..")) return null;
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "users") {
    if (segments[1] !== userId) return null;
    return segments[2] ?? null;
  }
  return segments[0] ?? null;
}

// 为一组 Storage 路径生成短时签名 URL（私有 bucket 访问）。
// 只签当前用户自己书库内的文件，路径不属于本人则静默跳过。
export async function POST(request: Request) {
  const admin = createAdminSupabase();
  try {
    const user = await requireUser();
    const body = await request.json();
    const paths: string[] = Array.isArray(body?.paths)
      ? body.paths.filter((p: unknown) => typeof p === "string" && p.length > 0)
      : [];

    // 1. 逐条解析 document_id，并批量确认归属
    const docIdByPath = new Map<string, string>();
    for (const p of paths) {
      const docId = extractDocumentId(p, user.id);
      if (docId) docIdByPath.set(p, docId);
    }

    const docIds = [...new Set(docIdByPath.values())];
    const { data: ownedDocs } = docIds.length
      ? await admin
          .from("documents")
          .select("id")
          .eq("owner_id", user.id)
          .in("id", docIds)
      : { data: [] };
    const ownedIds = new Set((ownedDocs ?? []).map((d: { id: string }) => d.id));

    // 2. 只对属于本人的路径签名
    const urls: Record<string, string> = {};
    for (const p of paths) {
      const docId = docIdByPath.get(p);
      if (!docId || !ownedIds.has(docId)) continue;
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(p, 3600);
      if (data?.signedUrl) urls[p] = data.signedUrl;
    }
    return NextResponse.json({ urls });
  } catch (e) {
    return errorResponse(e);
  }
}
