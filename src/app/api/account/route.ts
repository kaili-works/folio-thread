import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { ApiError, requireUser } from "@/lib/auth";
import { removeBookFiles } from "@/lib/book-media";
import { errorResponse } from "@/lib/api-response";

const BUCKET = "shared";

// 删除账号：先清理 Storage（users/{uid}/ 与历史路径），再删业务数据，最后删 auth 用户。
export async function DELETE() {
  try {
    const user = await requireUser();
    const admin = createAdminSupabase();

    // 1. Storage：新路径 users/{uid}/{docId}/... 与历史路径 {docId}/...
    const { data: docs } = await admin
      .from("documents")
      .select("id, file_path")
      .eq("owner_id", user.id);

    const basePaths = new Set<string>([`users/${user.id}`]);
    for (const d of docs ?? []) {
      const dir = (d.file_path ?? "").split("/").slice(0, -1).join("/");
      if (dir) basePaths.add(dir);
      basePaths.add(`users/${user.id}/${d.id}`);
    }

    // 逐个账号目录下的书籍子目录清理（removeBookFiles 处理 basePath 与 images/）
    for (const base of basePaths) {
      await removeBookFiles(admin, BUCKET, [base]);
    }
    // users/{uid}/ 下还有 {docId} 一级目录，单独列出并递归清理
    const { data: userDirs } = await admin.storage
      .from(BUCKET)
      .list(`users/${user.id}`, { limit: 100 });
    for (const dir of userDirs ?? []) {
      await removeBookFiles(admin, BUCKET, [`users/${user.id}/${dir.name}`]);
    }

    // 2. 业务数据：显式删除书库，其余表由 auth.users 外键级联删除
    const { error: docErr } = await admin
      .from("documents")
      .delete()
      .eq("owner_id", user.id);
    if (docErr) throw new ApiError(500, `清理书库失败：${docErr.message}`);

    // 3. 最后删除 auth 用户
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new ApiError(500, `删除账号失败：${error.message}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
