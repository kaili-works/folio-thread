import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * 带用户身份的服务端客户端：从 Cookie 读取登录态，受 RLS 约束。
 * 用于「读」操作和校验当前用户身份。
 */
export async function createServerSupabase() {
  // Next.js 15 起 cookies() 为异步 API
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 服务端组件里 set 会抛错，可安全忽略
          }
        },
      },
    },
  );
}

/**
 * 服务端管理员客户端：使用 service_role key，绕过 RLS。
 * 仅用于受控的服务端内部写入（如解析后写入 chapters/paragraphs），
 * 调用前必须在业务代码里先校验用户是 admin。
 */
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
