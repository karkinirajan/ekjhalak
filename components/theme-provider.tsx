"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { themes, type ThemeName, type ThemePalette } from "@/lib/themes"
import { i18n, type Lang, type I18nDict } from "@/lib/i18n"

interface ThemeContextValue {
  themeMode: ThemeName
  setThemeMode: (t: ThemeName) => void
  palette: ThemePalette
  language: Lang
  setLanguage: (l: Lang) => void
  t: I18nDict
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: "dark",
  setThemeMode: () => {},
  palette: themes.dark,
  language: "en",
  setLanguage: () => {},
  t: i18n.en,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeName>("dark")
  const [language, setLanguageState] = useState<Lang>("en")

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("cfn-theme")
    if (savedTheme === "dark" || savedTheme === "light") {
      setThemeModeState(savedTheme)
    }
    const savedLang = window.localStorage.getItem("cfn-lang")
    if (savedLang === "en" || savedLang === "np") {
      setLanguageState(savedLang)
    }
  }, [])

  function setThemeMode(mode: ThemeName) {
    setThemeModeState(mode)
    window.localStorage.setItem("cfn-theme", mode)
  }

  function setLanguage(l: Lang) {
    setLanguageState(l)
    window.localStorage.setItem("cfn-lang", l)
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
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
