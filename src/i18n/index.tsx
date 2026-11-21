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

export type Locale = "zh" | "en";

// 以中文文案为结构基准：en.ts 必须与它同构。
export type Dict = typeof zh;

export const dictionaries: Record<Locale, Dict> = { zh, en };

const STORAGE_KEY = "locale";

interface I18nValue {
  locale: Locale;
  t: Dict;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

/**
 * 语言上下文。首屏固定渲染中文（与服务端输出一致，避免 hydration 不匹配），
 * 挂载后再读取本地偏好切换。
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
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
