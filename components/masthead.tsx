"use client";

import { startTransition, useEffect, useState } from "react";
import { Languages, RefreshCw, Search } from "lucide-react";
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
  onSubscribe,
}: MastheadProps) {
  const { t, language, toggleLanguage } = useTheme();
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

  return (
    <header className="border-b border-rule bg-canvas">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* ── Top rule: dateline + utilities ─────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-b border-rule/60 py-2.5">
          <p
            className="eyebrow hidden truncate text-ink-muted md:block"
            suppressHydrationWarning
          >
            {dateline ?? " "}
          </p>

          <div className="flex items-center gap-1 md:gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={t.refreshFeed}
              className="rounded-full text-ink-muted hover:text-ink"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
                aria-hidden="true"
              />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              aria-label={t.langToggleLabel}
              className={cn(
                "h-8 gap-1.5 rounded-full px-2.5 text-xs text-ink-muted hover:text-ink",
                !isNp && "font-np",
              )}
            >
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              {t.langButton}
            </Button>

            <span aria-hidden="true" className="mx-1 h-4 w-px bg-rule" />

            <Button
              size="sm"
              onClick={onSubscribe}
              className={cn(
                "h-8 rounded-full bg-red px-3.5 text-xs font-semibold text-white hover:bg-red/90",
                isNp && "font-np",
              )}
            >
              {t.subscribe}
            </Button>
          </div>
        </div>

        {/* ── Nameplate ──────────────────────────────────────────────────── */}
        <div className="grid items-center gap-4 py-6 sm:py-8 lg:grid-cols-[1fr_auto_1fr]">
          {/* Balances the search field in the third column, so the wordmark
              stays optically centred rather than merely centred in its cell. */}
          <BrandBanner className="hidden lg:block" />

          <div className="text-center">
            <h1 className="leading-[0.9]">
              <span
                className={cn(
                  "block text-[clamp(2.5rem,9vw,5rem)] font-black tracking-[-0.035em] text-ink",
                  isNp ? "font-np" : "font-display-soft",
                )}
              >
                {t.wordmark}
              </span>
              <span
                className={cn(
                  "mt-1.5 block text-[clamp(0.95rem,3vw,1.35rem)] font-semibold tracking-tight text-red",
                  isNp ? "font-display" : "font-np",
                )}
              >
                {t.wordmarkNp}
              </span>
            </h1>

            {/* Rule-and-tagline device — the line breaking around the text is a
                broadsheet convention that costs nothing and reads as considered. */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-rule-strong sm:w-14" />
              <p
                className={cn(
                  "eyebrow text-ink-muted",
                  isNp && "font-np tracking-normal",
                )}
              >
                {t.tagline}
              </p>
              <span className="h-px w-8 bg-rule-strong sm:w-14" />
            </div>
          </div>

          {/* Search sits in the third column so the wordmark stays optically
              centred on large screens; it drops below on small ones. */}
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
            className="w-full lg:max-w-64 lg:justify-self-end"
          >
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
              />
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className={cn(
                  "h-9 rounded-full border-rule-strong bg-surface pl-9 text-sm placeholder:text-ink-muted",
                  isNp && "font-np",
                )}
              />
            </div>
          </form>
        </div>
      </div>
    </header>
  );
}
