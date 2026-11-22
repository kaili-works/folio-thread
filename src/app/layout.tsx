import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { IconSprite } from "@/components/Icon";
import { I18nProvider } from "@/i18n";
import { getRequestLocale } from "@/lib/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const isEn = locale === "en";

  return {
    title: isEn ? "FolioThread · Read with direction" : "FolioThread · 页脉研读",
    description: isEn
      ? "Thread your way through the shelf, one chapter a day."
      : "沿着书页的脉络，一天一章",
    icons: {
      icon: "/icon.svg",
      apple: "/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      title: isEn ? "FolioThread" : "页脉研读",
      statusBarStyle: "default",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#111827" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('reader-theme');var d=t==='dark'||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <IconSprite />
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
