"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearUserCache } from "@/lib/offline";
import OnboardingModal from "@/components/OnboardingModal";
import GuideModal from "@/components/GuideModal";

// 应用外壳导航：桌面顶栏 + 移动端底部三栏（左=市集，中=＋创建，右=今日）
export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      if (!u) return;
      setUserId(u.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    if (userId) await clearUserCache(userId);
    await supabase.auth.signOut();
    router.push("/");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/today" className="app-logo">
            FolioThread<em>页脉研读</em>
          </Link>
          <nav className="app-nav-desktop">
            <Link href="/themes" className={isActive("/themes") ? "active" : ""}>
              主题与清单
            </Link>
            <Link href="/library" className={isActive("/library") ? "active" : ""}>
              我的书库
            </Link>
            <Link href="/today" className={isActive("/today") ? "active" : ""}>
              今日阅读包
            </Link>
            <Link href="/stats" className={isActive("/stats") ? "active" : ""}>
              统计
            </Link>
          </nav>
          <div className="app-header-right">
            <Link
              href="/market"
              className="app-header-market"
              aria-label="书单市集"
            >
              书单市集
            </Link>
            <Link
              href="/library"
              className={`app-header-quick app-header-library${isActive("/library") ? " active" : ""}`}
              aria-label="书库"
            >
              书库
            </Link>
            <Link
              href="/notes"
              className={`app-header-quick app-header-notes ${isActive("/notes") ? "active" : ""}`}
              aria-label="笔记"
            >
              笔记
            </Link>
            <button
              aria-label="操作指南"
              onClick={() => setGuideOpen(true)}
            >
              指南
            </button>
            <button onClick={logout}>退出</button>
          </div>
        </div>
      </header>

      <nav className="app-tabs">
        <Link href="/market" className={isActive("/market") ? "active" : ""}>
          <span className="tab-label">书单市集</span>
        </Link>
        <Link
          href="/themes"
          className={`tab-plus ${isActive("/themes") ? "active" : ""}`}
        >
          <span className="plus-circle">＋</span>
          <span>新建</span>
        </Link>
        <Link href="/today" className={isActive("/today") ? "active" : ""}>
          <span className="tab-label">今日</span>
        </Link>
      </nav>

      {userId && <OnboardingModal />}
      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    </>
  );
}
