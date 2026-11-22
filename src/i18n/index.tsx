"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { zh } from "./zh";
import { en } from "./en";
import { LOCALE_COOKIE, type Locale } from "./locale";

export type { Locale };

// 以中文文案为结构基准：en.ts 必须与它同构。
export type Dict = typeof zh;

export const dictionaries: Record<Locale, Dict> = { zh, en };

interface I18nValue {
  locale: Locale;
  t: Dict;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * 语言上下文。初始语言由服务端根据 cookie / Accept-Language 算好传进来，
 * 因此首屏 HTML、<html lang> 与客户端首帧是同一个语言，不会闪一下再切换。
 */
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // cookie 是唯一事实源：服务端也要用它渲染首屏；一年有效，刷新后仍保持。
    try {
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    } catch {
      // 隐私模式下写入失败，仅影响下次访问的默认语言
    }
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t: dictionaries[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n 必须在 I18nProvider 内使用");
  return value;
}

/** 只取文案对象，页面大多数情况用这个。 */
export function useT(): Dict {
  return useI18n().t;
}
