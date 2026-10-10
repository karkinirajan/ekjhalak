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

/**
 * What the reader chose, as opposed to what the OS prefers.
 *
 * "system" is a real third state, not the absence of a choice: it means follow
 * `prefers-color-scheme`, and it is what the site does until someone decides
 * otherwise. Collapsing it into light-or-dark is what makes a toggle stop
 * tracking the OS the first time it is touched.
 */
export type ThemeChoice = "system" | "light" | "dark";

/** The two the page can actually be painted in, once "system" is resolved. */
export type ResolvedTheme = "light" | "dark";

interface SiteContextValue {
  language: Lang;
  setLanguage: (l: Lang) => void;
  toggleLanguage: () => void;
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: ThemeChoice) => void;
  toggleTheme: () => void;
  t: I18nDict;
}

const SiteContext = createContext<SiteContextValue>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
  t: i18n.en,
});

const THEME_KEY = "cfn-theme";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Reader preferences.
 *
 * Two preferences: the reading language, and the theme.
 *
 * Colour itself does not live here — it lives in the CSS custom properties in
 * globals.css, keyed off `data-theme` on <html>. This owns the *state* of that
 * attribute so the toggle can render the right icon and label, and so a choice
 * survives a reload.
 *
 * The attribute is written by the pre-paint script in app/layout.tsx before
 * React runs. Writing it here as well, on mount, would mean a frame of the
 * wrong theme on every visit; the effect below only reconciles React to what
 * the document already says.
 */
export function SiteProvider({ children }: { children: React.ReactNode }) {
  // SSR renders the documented defaults; the head script has already set both
  // <html lang> and data-theme from storage, and the effect below reconciles
  // React to what the document is already showing.
  const [language, setLanguageState] = useState<Lang>("en");
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    let saved: string | null = null;
    let savedTheme: string | null = null;
    try {
      saved = localStorage.getItem("cfn-lang");
      savedTheme = localStorage.getItem(THEME_KEY);
    } catch {
      // Private browsing / blocked storage — fall back to the defaults.
    }

    const choice: ThemeChoice =
      savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system";

    startTransition(() => {
      if (saved === "en" || saved === "np") setLanguageState(saved);
      setThemeState(choice);
      setResolvedTheme(
        choice === "system" ? (systemPrefersDark() ? "dark" : "light") : choice,
      );
    });
  }, []);

  // While the reader is on "system", the OS can still change underneath them —
  // most desktops switch at sunset. Without this the page keeps whichever theme
  // it was opened in until a reload, which reads as the toggle being broken.
  useEffect(() => {
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setResolvedTheme(query.matches ? "dark" : "light");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    const resolved: ResolvedTheme =
      next === "system" ? (systemPrefersDark() ? "dark" : "light") : next;
    setResolvedTheme(resolved);

    // "system" removes the attribute rather than stamping a value, so the
    // media query in globals.css is what decides — which is the whole point of
    // the state existing.
    if (next === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }

    try {
      if (next === "system") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing / blocked storage — the choice just won't persist.
    }
  }, []);

  // The toggle is a two-way switch over what the reader is *seeing*, not a
  // three-way cycle through the stored states. Someone looking at a dark page
  // and pressing it expects light, whether that darkness came from their OS or
  // from an earlier choice.
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

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
      value={{
        language,
        setLanguage,
        toggleLanguage,
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        t: i18n[language],
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}
