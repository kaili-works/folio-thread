import { NextResponse } from "next/server";
import { ApiError, requireUser } from "@/lib/auth";
import { matchPendingSupplements } from "@/lib/matching";
import { errorResponse } from "@/lib/api-response";

// 手动触发「刷新剩余清单」：在本人的书库与本人的清单之间重新匹配待补充候选
export async function POST() {
  try {
    const user = await requireUser();
    const matched = await matchPendingSupplements(user.id);
    return NextResponse.json({ matched });
  } catch (e) {
    return errorResponse(e);
  }
}
