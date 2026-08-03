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
            {/* Refresh, with the stamp it produces alongside it.
                This number used to sit at the far right of the breaking ticker,
                two rows away from the only control that changes it and with
                nothing to say what it measured. Here it reads as one statement:
                this is when the feed was last pulled, and this is the button
                that pulls it again. */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={t.refreshFeed}
              className="h-8 gap-2 px-2 text-ink-muted hover:text-ink"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
                aria-hidden="true"
              />
              <span className="eyebrow hidden tabular-nums sm:inline">
                <span className={cn(isNp && "font-np tracking-normal")}>
                  {t.updatedAt}
                </span>{" "}
                <span suppressHydrationWarning>{updatedLabel}</span>
              </span>
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label={themeMode === "dark" ? t.themeLight : t.themeDark}
              className="rounded-sm text-ink-muted hover:text-ink"
            >
              {themeMode === "dark" ? (
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <MoonStar className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              aria-label={t.langToggleLabel}
              className={cn(
                "h-8 gap-1.5 rounded-sm px-2.5 text-xs text-ink-muted hover:text-ink",
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
                "h-8 rounded-sm bg-red-solid px-3.5 text-xs font-semibold text-white hover:bg-red-solid/90",
                isNp && "font-np",
              )}
            >
              {t.subscribe}
            </Button>
          </div>
        </div>

        {/* ── Nameplate ──────────────────────────────────────────────────────
            The whole block used to run 152px tall, and with the ticker, the
            utility row and the two filter rails above and below it, the lead
            story started 430px down — 35% of a 1230px screen, and 54% of an
            800px laptop, spent on furniture before any news. A nameplate should
            establish the paper, not hold the front page below the fold, so the
            wordmark ceiling comes down from 5rem to 3.5rem and the vertical
            padding roughly halves. It still reads as a broadsheet masthead; it
            just stops charging the reader a screenful for the privilege. */}
        <div className="grid items-center gap-4 py-4 sm:py-5 lg:grid-cols-[1fr_auto_1fr]">
          {/* Balances the search field in the third column, so the wordmark
              stays optically centred rather than merely centred in its cell. */}
          <BrandBanner className="hidden lg:block" />

          <div className="text-center">
            {/* The name, once.
                A second line carried the same name in the other script — an
                English nameplate reading "EkJhalak" over "एक झलक", a Nepali one
                reading "एक झलक" over "EkJhalak". Printing a paper's own name
                twice, one above the other, reads as a mistake rather than as a
                device; the language toggle already decides which script the
                reader wants. */}
            <h1 className="leading-[0.9]">
              <span
                className={cn(
                  "block text-[clamp(2rem,6.5vw,3.4rem)] font-semibold tracking-[-0.035em] text-ink",
                  isNp ? "font-np" : "font-display",
                )}
              >
                {t.wordmark}
              </span>
            </h1>

            {/* Rule-and-tagline device — the line breaking around the text is a
                broadsheet convention that costs nothing and reads as considered. */}
            <div className="mt-2.5 flex items-center justify-center gap-3">
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
            /* The field tracks the width it is given rather than sitting at one
               fixed size. It is full-bleed on the small screens where it drops
               below the nameplate, and on large ones it grows with the masthead
               instead of staying pinned at 16rem — which is where a placeholder
               longer than about twenty characters used to be clipped mid-word. */
            className="w-full lg:max-w-[min(20rem,26vw)] lg:min-w-44 lg:justify-self-end"
          >
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
              />
              <Input
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchLabel}
                className={cn(
                  "h-9 w-full min-w-0 rounded-sm border-rule-strong bg-surface pl-9 text-sm placeholder:text-ink-muted",
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
