"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { themes, type ThemeName, type ThemePalette } from "@/lib/themes";
import { i18n, type Lang, type I18nDict } from "@/lib/i18n";

interface ThemeContextValue {
  themeMode: ThemeName;
  setThemeMode: (t: ThemeName) => void;
  palette: ThemePalette;
  language: Lang;
  setLanguage: (l: Lang) => void;
  t: I18nDict;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: "dark",
  setThemeMode: () => {},
  palette: themes.dark,
  language: "en",
  setLanguage: () => {},
  t: i18n.en,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with stable defaults so SSR HTML matches the first client render.
  // After mount, read the user's saved preferences from localStorage.
  const [themeMode, setThemeModeState] = useState<ThemeName>("dark");
  const [language, setLanguageState] = useState<Lang>("en");

  // Hydrate from localStorage after mount — avoids SSR mismatch.
  useEffect(() => {
    const savedTheme = localStorage.getItem("cfn-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setThemeModeState(savedTheme);
    }
    const savedLang = localStorage.getItem("cfn-lang");
    if (savedLang === "en" || savedLang === "np") {
      setLanguageState(savedLang as Lang);
    }
  }, []);

  function setThemeMode(mode: ThemeName) {
    setThemeModeState(mode);
    window.localStorage.setItem("cfn-theme", mode);
  }

  function setLanguage(l: Lang) {
    setLanguageState(l);
    window.localStorage.setItem("cfn-lang", l);
  }

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        palette: themes[themeMode],
        language,
        setLanguage,
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
