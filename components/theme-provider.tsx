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

interface ThemeContextValue {
  language: Lang;
  setLanguage: (l: Lang) => void;
  toggleLanguage: () => void;
  t: I18nDict;
}

const ThemeContext = createContext<ThemeContextValue>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: i18n.en,
});

/**
 * Language preference.
 *
 * Colour is no longer a preference: the paper is printed on one dark stock in
 * black, grey, red and green, defined entirely in CSS custom properties. There
 * is no theme state to carry, so this provider owns language alone.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR renders English; the effect below reconciles to a stored choice on
  // mount. The <html lang> attribute is set pre-paint by the head script.
  const [language, setLanguageState] = useState<Lang>("en");

  useEffect(() => {
    const savedLang = localStorage.getItem("cfn-lang");
    startTransition(() => {
      if (savedLang === "en" || savedLang === "np") setLanguageState(savedLang);
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
    <ThemeContext.Provider
      value={{ language, setLanguage, toggleLanguage, t: i18n[language] }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
