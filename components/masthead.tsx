"use client";

import { Languages, RefreshCw, Search } from "lucide-react";
import { BrandBanner } from "@/components/brand-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSite } from "@/components/site-provider";
import { cn } from "@/lib/utils";

interface MastheadProps {
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  applySearch: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  /** When the feed was last fetched — the timestamp shown is real, not decorative */
  onSubscribe: () => void;
}


/**
 * The nameplate.
 *
 * Laid out as a broadsheet masthead: brand mark on the left, wordmark beside
 * it, search in the middle and utilities on the right, over a single rule. It
 * scrolls away and leaves the section nav stuck to the top — see the note on
 * the return below.
 */
export function Masthead({
  searchDraft,
  setSearchDraft,
  applySearch,
  onRefresh,
  isRefreshing,
  onSubscribe,
}: MastheadProps) {
  const { t, language, toggleLanguage } = useSite();
  const isNp = language === "np";

  // Not sticky. The masthead and the section nav were both `sticky top-0`, and
  // the header — 65px tall and z-50 against the nav's z-30 — painted over the
  // top of the nav, so the section rail was unusable the moment the page
  // scrolled. The translucent blur that used to be on `.glass` hid it.
  //
  // The masthead scrolls away and the section nav sticks, which is what the
  // Kathmandu Post and the Guardian both do: once you are reading, the rail that
  // moves you between sections is worth the strip at the top of the screen and
  // the wordmark is not. A fixed offset on the nav would have been the other
  // fix, and it breaks the moment the header wraps to two rows on mobile, which
  // it does.
  return (
    <header className="relative z-50 w-full glass">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <BrandBanner className="hidden md:block h-10 w-auto" />
          <h1 className="leading-none">
            <span
              className={cn(
                "block text-2xl md:text-[1.75rem] font-bold tracking-normal text-ink",
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
                "h-10 w-full rounded-sm border border-rule bg-surface pl-10 pr-4 text-sm focus-visible:ring-2 focus-visible:ring-accent",
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
            className="rounded-md text-ink-muted hover:text-ink hover:bg-surface/50"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              aria-hidden="true"
            />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            aria-label={t.langToggleLabel}
            className={cn(
              "h-8 gap-1.5 rounded-md px-3 text-xs text-ink-muted hover:text-ink hover:bg-surface/50",
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
              "h-8 rounded-md bg-accent-solid px-4 text-xs font-bold text-white hover:opacity-90 transition-opacity",
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
              "h-12 w-full rounded-sm bg-surface border border-rule pl-11 pr-4 text-sm focus-visible:ring-2 focus-visible:ring-accent",
              isNp && "font-np",
            )}
          />
        </form>
      </div>
    </header>
  );
}
