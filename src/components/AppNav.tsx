"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearUserCache } from "@/lib/offline";
import OnboardingModal from "@/components/OnboardingModal";
import GuideModal from "@/components/GuideModal";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/i18n";

// 应用外壳导航：桌面顶栏 + 移动端底部三栏（左=市集，中=＋创建，右=今日）
export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { locale, t, setLocale } = useI18n();

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
              <Icon name="themes" />
              {t.nav.themes}
            </Link>
            <Link href="/library" className={isActive("/library") ? "active" : ""}>
              <Icon name="library" />
              {t.nav.library}
            </Link>
            <Link href="/today" className={isActive("/today") ? "active" : ""}>
              <Icon name="today" />
              {t.nav.today}
            </Link>
            <Link href="/stats" className={isActive("/stats") ? "active" : ""}>
              <Icon name="stats" />
              {t.nav.stats}
            </Link>
          </nav>
          <div className="app-header-right">
            <Link
              href="/market"
              className="app-header-market icon-only"
              aria-label={t.nav.market}
              data-tip={t.nav.market}
            >
              <Icon name="market" />
            </Link>
            <Link
              href="/library"
              className={`app-header-quick app-header-library icon-only${isActive("/library") ? " active" : ""}`}
              aria-label={t.nav.libraryShort}
              data-tip={t.nav.libraryShort}
            >
              <Icon name="library" />
            </Link>
            <Link
              href="/notes"
              className={`app-header-quick app-header-notes icon-only ${isActive("/notes") ? "active" : ""}`}
              aria-label={t.nav.notes}
              data-tip={t.nav.notes}
            >
              <Icon name="note" />
            </Link>
            <button
              className="icon-only"
              aria-label={t.nav.guide}
              data-tip={t.nav.guide}
              onClick={() => setGuideOpen(true)}
            >
              <Icon name="guide" />
            </button>
            <button
              aria-label={t.nav.switchLanguage}
              title={t.nav.switchLanguage}
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            >
              {locale === "zh" ? "EN" : "中"}
            </button>
            <button
              className="icon-only"
              onClick={logout}
              aria-label={t.nav.logout}
              data-tip={t.nav.logout}
            >
              <Icon name="exit" />
            </button>
          </div>
        </div>
      </header>

      <nav className="app-tabs">
        <Link
          href="/market"
          className={isActive("/market") ? "active" : ""}
          aria-label={t.nav.market}
          title={t.nav.market}
        >
          <Icon name="market" size={20} />
        </Link>
        <Link
          href="/themes"
          className={`tab-plus ${isActive("/themes") ? "active" : ""}`}
          aria-label={t.nav.newTheme}
          title={t.nav.newTheme}
        >
          <span className="plus-circle">
            <Icon name="plus" size={16} />
          </span>
        </Link>
        <Link
          href="/today"
          className={isActive("/today") ? "active" : ""}
          aria-label={t.nav.todayShort}
          title={t.nav.todayShort}
        >
          <Icon name="today" size={20} />
        </Link>
      </nav>

      {userId && <OnboardingModal />}
      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    </>
  );
}
