"use client";

import { startTransition, useEffect, useState } from "react";
import { Languages, MoonStar, RefreshCw, Search, Sun } from "lucide-react";
import { BrandBanner } from "@/components/brand-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface MastheadProps {
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  applySearch: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  /** When the feed was last fetched — the timestamp shown is real, not decorative */
  fetchedAt: number;
  onSubscribe: () => void;
}

const KATHMANDU_TZ = "Asia/Kathmandu";

/**
 * The nameplate.
 *
 * Laid out as a broadsheet masthead: rules above and below, dateline on the
 * left, wordmark centred, utilities on the right. The centring is what makes it
 * read as a publication — a left-aligned logo with a nav bar reads as an app.
 */
export function Masthead({
  searchDraft,
  setSearchDraft,
  applySearch,
  onRefresh,
  isRefreshing,
  fetchedAt,
  onSubscribe,
}: MastheadProps) {
  const { t, language, toggleLanguage, themeMode, toggleTheme } = useTheme();
  const [dateline, setDateline] = useState<string | null>(null);

  // Rendered client-side only: the date depends on the reader's calendar
  // rolling over in Kathmandu, which cached server HTML cannot track.
  // Deferred as a transition so it never blocks the masthead's first paint.
  useEffect(() => {
    const formatted = new Date().toLocaleDateString(
      language === "np" ? "ne-NP" : "en-US",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: KATHMANDU_TZ,
      },
    );
    startTransition(() => setDateline(formatted));
  }, [language]);

  const isNp = language === "np";

  // An em dash until the first fetch lands, rather than 05:45 — the epoch
  // rendered in Kathmandu time, which is what formatting 0 would print.
  const updatedLabel =
    fetchedAt > 0
      ? new Date(fetchedAt).toLocaleTimeString(isNp ? "ne-NP" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: KATHMANDU_TZ,
        })
      : "—";

  return (
    <header className="sticky top-0 z-50 w-full transition-all duration-300 glass border-b border-rule/50 shadow-sm">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <BrandBanner className="hidden md:block h-10 w-auto" />
          <h1 className="leading-none">
            <span
              className={cn(
                "block text-xl md:text-2xl font-bold tracking-tight text-ink",
                isNp ? "font-np" : "font-display",
              )}
            >
              {t.wordmark}
            </span>
          </h1>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md hidden lg:block">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
            className="w-full relative"
          >
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted"
            />
            <Input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchLabel}
              className={cn(
                "h-10 w-full rounded-full border-none bg-surface/50 shadow-inner pl-10 pr-4 text-sm focus-visible:ring-2 focus-visible:ring-red",
                isNp && "font-np",
              )}
            />
          </form>
        </div>

        {/* Utilities */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={t.refreshFeed}
            className="rounded-full text-ink-muted hover:text-ink hover:bg-surface/50"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              aria-hidden="true"
            />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label={themeMode === "dark" ? t.themeLight : t.themeDark}
            className="rounded-full text-ink-muted hover:text-ink hover:bg-surface/50"
          >
            {themeMode === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <MoonStar className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            aria-label={t.langToggleLabel}
            className={cn(
              "h-8 gap-1.5 rounded-full px-3 text-xs text-ink-muted hover:text-ink hover:bg-surface/50",
              !isNp && "font-np",
            )}
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t.langButton}</span>
          </Button>

          <Button
            size="sm"
            onClick={onSubscribe}
            className={cn(
              "h-8 rounded-full bg-gradient-to-r from-red-solid to-red px-4 text-xs font-bold text-white shadow-md hover:opacity-90 transition-opacity",
              isNp && "font-np",
            )}
          >
            {t.subscribe}
          </Button>
        </div>
      </div>
      
      {/* Mobile Search */}
      <div className="w-full px-4 pb-4 lg:hidden">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
          className="w-full relative"
        >
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-muted"
          />
          <Input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchLabel}
            className={cn(
              "h-12 w-full rounded-2xl bg-surface/60 backdrop-blur-xl shadow-card border border-rule/50 pl-11 pr-4 text-sm focus-visible:ring-2 focus-visible:ring-red",
              isNp && "font-np",
            )}
          />
        </form>
      </div>
    </header>
  );
}
