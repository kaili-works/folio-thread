import { NextResponse } from "next/server";
import { ApiError } from "@/lib/auth";
import { tApi } from "@/lib/api-messages";
import { getRequestLocale } from "@/lib/request-locale";

/**
 * 统一的接口异常出口：按当前界面语言返回报错文案。
 * 路由里的 catch 块直接 `return errorResponse(e)` 即可。
 */
export async function errorResponse(e: unknown): Promise<NextResponse> {
  const locale = await getRequestLocale();

  if (e instanceof ApiError) {
    return NextResponse.json(
      { error: tApi(locale, e.message) },
      { status: e.status },
    );
  }
  return NextResponse.json(
    { error: tApi(locale, (e as Error).message) },
    { status: 500 },
  );
}
