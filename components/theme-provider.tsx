"use client"

import { createContext, useContext, useState } from "react"
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
  // Initialize from the data attribute set by the blocking script in layout.tsx.
  // This avoids a flash of the default dark theme for users who prefer light.
  // The attribute is set synchronously before first paint; reading it here gives
  // the correct initial value on the client without any useEffect/re-render cycle.
  const [themeMode, setThemeModeState] = useState<ThemeName>(() => {
    if (typeof document !== "undefined") {
      const attr = document.documentElement.getAttribute("data-cfn-theme")
      if (attr === "dark" || attr === "light") return attr
    }
    return "dark"
  })
  // Initialize language from localStorage immediately (same pattern as theme above).
  // Avoids a setState-in-effect cycle; lang preference is read synchronously before
  // the first render, so there is no flash of the wrong language.
  const [language, setLanguageState] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cfn-lang")
      if (saved === "en" || saved === "np") return saved as Lang
    }
    return "en"
  })

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
