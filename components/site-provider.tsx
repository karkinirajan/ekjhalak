"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { i18n, type I18nDict, type Lang } from "@/lib/i18n";

interface SiteContextValue {
  language: Lang;
  setLanguage: (l: Lang) => void;
  toggleLanguage: () => void;
  t: I18nDict;
}

const SiteContext = createContext<SiteContextValue>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: i18n.en,
});

/**
 * Reader preferences.
 *
 * This was `SiteProvider`, and it owned two things: the `data-theme`
 * attribute on <html> and the reading language. The site is light only now —
 * there is one palette, set unconditionally in globals.css, and no attribute
 * for anything to own — so what is left is the language, which is the only
 * preference a reader still has.
 *
 * Colour never lived here in the first place; it lives in CSS custom
 * properties. What is gone is the *state* of a choice that no longer exists.
 */
export function SiteProvider({ children }: { children: React.ReactNode }) {
  // SSR renders the documented default; the head script has already set
  // <html lang> from storage, and the effect below reconciles React to it.
  const [language, setLanguageState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("cfn-lang");
    startTransition(() => {
      if (saved === "en" || saved === "np") setLanguageState(saved);
    });
  }, []);

  const setLanguage = useCallback((lang: Lang) => {
    setLanguageState(lang);
    document.documentElement.lang = lang === "np" ? "ne" : "en";
    try {
      window.localStorage.setItem("cfn-lang", lang);
    } catch {
      // Private browsing / blocked storage — the choice just won't persist.
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "np" : "en");
  }, [language, setLanguage]);

  return (
    <SiteContext.Provider
      value={{ language, setLanguage, toggleLanguage, t: i18n[language] }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}
