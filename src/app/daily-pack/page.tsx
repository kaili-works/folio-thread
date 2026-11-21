"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 已迁移到 /today（每日阅读包 + 统计概览），保留此路由做重定向。
export default function DailyPackRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/today");
  }, [router]);
  return null;
}
