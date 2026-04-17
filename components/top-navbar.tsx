"use client";

import { Languages, MoonStar, RefreshCw, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandImage } from "@/components/brand-image";
import { cn } from "@/lib/utils";
import type { RangeKey } from "@/lib/news-pipeline";
import { useTheme } from "@/components/theme-provider";

type BucketFilter = "all" | "national" | "international";

interface TopNavbarProps {
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  applySearch: () => void;
  fetchFeed: (isBackground?: boolean) => Promise<void>;
  loadState: "idle" | "loading" | "refreshing" | "error";
  themeMode: "dark" | "light";
  setThemeMode: (value: "dark" | "light") => void;
  language: "en" | "np";
  setLanguage: (value: "en" | "np") => void;
  range: RangeKey;
  setRange: (value: RangeKey) => void;
  bucket: BucketFilter;
  setBucket: (value: BucketFilter) => void;
  rangeLabel: string;
  filteredCount: number;
}

export function TopNavbar({
  searchDraft,
  setSearchDraft,
  applySearch,
  fetchFeed,
  loadState,
  themeMode,
  setThemeMode,
  language,
  setLanguage,
  range,
  setRange,
  bucket,
  setBucket,
  rangeLabel,
  filteredCount,
}: TopNavbarProps) {
  const { palette, t } = useTheme();
  const isSpinning = loadState === "loading" || loadState === "refreshing";

  return (
    <div className="sticky top-0 z-50 -mx-2 lg:-mx-3">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 bottom-0 border-x-0 border-t-0 rounded-none backdrop-blur-xl shadow-sm",
          palette.shell,
        )}
      />
      <div className="relative">
        <div className="px-4 pt-3 pb-3 sm:pt-4">
          <div className="flex flex-col gap-3 md:grid md:grid-cols-[auto_minmax(0,1fr)] md:gap-4">
            <BrandImage
              priority
              containerClassName="mt-1 min-h-20 md:row-span-3 md:min-h-full md:items-start md:justify-start md:pr-2"
              imageClassName="max-h-14 sm:max-h-16 md:max-h-15"
            />

            <div className="grid gap-2 md:grid-cols-3 md:items-start">
              <div className="flex flex-col gap-1.5 md:items-start">
                <div
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wide",
                    palette.muted,
                  )}
                >
                  {t.statTimelineTitle}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { key: "day", label: t.rangeDay },
                      { key: "week", label: t.rangeWeek },
                      { key: "month", label: t.rangeMonth },
                    ] as const
                  ).map((item) => (
                    <Button
                      key={item.key}
                      variant="outline"
                      size="sm"
                      onClick={() => setRange(item.key)}
                      aria-pressed={range === item.key}
                      className={cn(
                        "h-7 rounded-lg px-2 text-[11px]",
                        range === item.key ? palette.accent : palette.ghost,
                      )}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 md:items-center">
                <div
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wide",
                    palette.muted,
                  )}
                >
                  {t.statFeedTitle}
                </div>
                <div className="grid grid-cols-3 gap-1.5 md:w-full">
                  {(
                    [
                      { key: "all", label: t.feedAll },
                      { key: "national", label: t.feedNational },
                      { key: "international", label: t.feedInternational },
                    ] as const
                  ).map((item) => (
                    <Button
                      key={item.key}
                      variant="outline"
                      size="sm"
                      onClick={() => setBucket(item.key)}
                      aria-pressed={bucket === item.key}
                      className={cn(
                        "h-7 rounded-lg px-2 text-[11px]",
                        bucket === item.key ? palette.accent : palette.ghost,
                      )}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 md:items-end">
                <div
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wide",
                    palette.muted,
                  )}
                >
                  {t.statLangTitle}
                </div>
                <div className="grid grid-cols-3 gap-1.5 md:w-full">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => fetchFeed(false)}
                    disabled={isSpinning}
                    className={cn(
                      "h-7 w-7 justify-self-end rounded-lg",
                      palette.ghost,
                    )}
                    aria-label={t.refreshFeed}
                  >
                    <RefreshCw
                      className={cn(
                        "h-3.5 w-3.5",
                        isSpinning && "animate-spin",
                      )}
                      aria-hidden="true"
                    />
                  </Button>

                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() =>
                      setThemeMode(themeMode === "dark" ? "light" : "dark")
                    }
                    className={cn(
                      "h-7 w-7 justify-self-end rounded-lg",
                      palette.ghost,
                    )}
                    aria-label={
                      themeMode === "dark" ? t.themeLight : t.themeDark
                    }
                  >
                    {themeMode === "dark" ? (
                      <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <MoonStar className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLanguage(language === "en" ? "np" : "en")}
                    className={cn(
                      "h-7 justify-self-end rounded-lg px-2 text-[11px]",
                      palette.ghost,
                    )}
                    aria-label={t.langToggleLabel}
                  >
                    <Languages
                      className="mr-1 h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    {t.langButton}
                  </Button>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "grid gap-2 rounded-xl border px-3 py-2 text-xs md:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] md:items-center",
                palette.panel,
              )}
            >
              <div className="min-w-0 flex flex-wrap items-center gap-4">
                <span className={cn("font-semibold", palette.text)}>
                  {rangeLabel} {t.rangeSuffix}
                </span>
                <span className={cn("tabular-nums", palette.subtext)}>
                  {filteredCount} {t.filtered}
                </span>
                <span className={cn("hidden sm:inline", palette.muted)}>
                  {t.briefingDesc}
                </span>
              </div>

              <form
                className="flex min-w-0 items-center gap-2 md:justify-self-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  applySearch();
                }}
                role="search"
              >
                <div className="relative min-w-0 flex-1 md:w-[min(44vw,420px)]">
                  <Search
                    className={cn(
                      "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none opacity-75",
                      palette.muted,
                    )}
                    aria-hidden="true"
                  />
                  <Input
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    aria-label={t.searchPlaceholder}
                    className={cn(
                      "h-8 w-full rounded-xl pl-9 text-sm",
                      palette.input,
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  size="icon-sm"
                  className={cn("h-8 w-8 shrink-0 rounded-xl", palette.ghost)}
                  aria-label={t.searchPlaceholder}
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
