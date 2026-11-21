import { createServerSupabase, createAdminSupabase } from "./supabase/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// 校验当前登录用户（任意成员），否则抛出 ApiError（401）
export async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new ApiError(401, "未登录");
  return user;
}

// 校验当前用户是某本书的所有者（v2 私有书库：所有者隔离），否则抛出 404/403。
// service_role 绕过 RLS，因此凡是跨表读写的服务端操作都必须先过这一层。
export async function assertDocumentOwner(documentId: string, userId: string) {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("documents")
    .select("id, owner_id, file_path, cover_url")
    .eq("id", documentId)
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, "书籍不存在");
  if (data.owner_id !== userId) throw new ApiError(403, "无权访问这本书");
  return data;
}
