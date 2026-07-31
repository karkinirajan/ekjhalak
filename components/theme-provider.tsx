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

export type ThemeName = "dark" | "light";

interface ThemeContextValue {
  themeMode: ThemeName;
  setThemeMode: (t: ThemeName) => void;
  toggleTheme: () => void;
  language: Lang;
  setLanguage: (l: Lang) => void;
  toggleLanguage: () => void;
  t: I18nDict;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: "light",
  setThemeMode: () => {},
  toggleTheme: () => {},
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: i18n.en,
});

/**
 * Colour and language preferences.
 *
 * Colour itself lives entirely in CSS custom properties keyed off `data-theme`
 * on <html>, which the head script sets before first paint. This provider owns
 * the *state* of that attribute so React components can render the right icon
 * and label — it never carries the colour values themselves.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR renders the documented default; the head script has already painted the
  // reader's real choice, and the effect below reconciles React to it on mount.
  const [themeMode, setThemeModeState] = useState<ThemeName>("light");
  const [language, setLanguageState] = useState<Lang>("en");

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    const savedLang = localStorage.getItem("cfn-lang");
    startTransition(() => {
      if (attr === "dark" || attr === "light") setThemeModeState(attr);
      if (savedLang === "en" || savedLang === "np") setLanguageState(savedLang);
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeName) => {
    setThemeModeState(mode);
    document.documentElement.setAttribute("data-theme", mode);
    try {
      window.localStorage.setItem("cfn-theme", mode);
    } catch {
      // Private browsing / blocked storage — the choice just won't persist.
    }
  }, []);

  const setLanguage = useCallback((lang: Lang) => {
    setLanguageState(lang);
    document.documentElement.lang = lang === "np" ? "ne" : "en";
    try {
      window.localStorage.setItem("cfn-lang", lang);
    } catch {
      // Same as above.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode(themeMode === "dark" ? "light" : "dark");
  }, [themeMode, setThemeMode]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "np" : "en");
  }, [language, setLanguage]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        toggleTheme,
        language,
        setLanguage,
        toggleLanguage,
        t: i18n[language],
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
