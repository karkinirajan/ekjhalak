"use client";

import { Languages, MoonStar, RefreshCw, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SystemLogo } from "@/components/system-logo";
import { cn } from "@/lib/utils";
import type { RangeKey } from "@/lib/news-pipeline";
import { useTheme } from "@/components/theme-provider";

type BucketFilter = "all" | "national" | "international";

interface TopNavbarProps {
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  applySearch: () => void;
  fetchFeed: (isBackground?: boolean) => Promise<void>;
  loadState: "idle" | "refreshing" | "error";
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
  const isSpinning = loadState === "refreshing";

  const rangeOptions = [
    { key: "day" as const, label: t.rangeDay },
    { key: "week" as const, label: t.rangeWeek },
    { key: "month" as const, label: t.rangeMonth },
  ];

  const bucketOptions = [
    { key: "all" as const, label: t.feedAll },
    { key: "national" as const, label: t.feedNational },
    { key: "international" as const, label: t.feedInternational },
  ];

  return (
    <div className="sticky top-0 z-50">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-none border-x-0 border-t-0 backdrop-blur-xl",
          palette.shell,
        )}
      />
      <div className="relative px-3 pt-3 pb-3 sm:px-4">
        <div className="flex flex-col gap-3">
          {/* Brand row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <SystemLogo themeMode={themeMode} />
              <div className="leading-tight">
                <p
                  className={cn(
                    "font-display text-base font-semibold tracking-tight",
                    palette.text,
                  )}
                >
                  EkJhalak
                </p>
                <p className={cn("text-[11px] font-medium", palette.muted)}>
                  {t.briefingDesc}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => fetchFeed(false)}
                disabled={isSpinning}
                className={cn("h-8 w-8 rounded-lg", palette.ghost)}
                aria-label={t.refreshFeed}
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", isSpinning && "animate-spin")}
                  aria-hidden="true"
                />
              </Button>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  setThemeMode(themeMode === "dark" ? "light" : "dark")
                }
                className={cn("h-8 w-8 rounded-lg", palette.ghost)}
                aria-label={themeMode === "dark" ? t.themeLight : t.themeDark}
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
                  "h-8 rounded-lg px-2.5 text-[11px]",
                  palette.ghost,
                )}
                aria-label={t.langToggleLabel}
              >
                <Languages className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                {t.langButton}
              </Button>
            </div>
          </div>

          {/* Filter + search row */}
          <div
            className={cn(
              "grid gap-2 rounded-xl border px-3 py-2.5",
              palette.panel,
            )}
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="flex items-center gap-1.5 sm:justify-self-start">
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    palette.muted,
                  )}
                >
                  {t.statTimelineTitle}
                </span>
                <div className="flex gap-1">
                  {rangeOptions.map((item) => (
                    <Button
                      key={item.key}
                      variant="outline"
                      size="sm"
                      onClick={() => setRange(item.key)}
                      aria-pressed={range === item.key}
                      className={cn(
                        "h-7 rounded-md px-2 text-[11px]",
                        range === item.key ? palette.accent : palette.ghost,
                      )}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:justify-self-center">
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    palette.muted,
                  )}
                >
                  {t.statFeedTitle}
                </span>
                <div className="flex gap-1">
                  {bucketOptions.map((item) => (
                    <Button
                      key={item.key}
                      variant="outline"
                      size="sm"
                      onClick={() => setBucket(item.key)}
                      aria-pressed={bucket === item.key}
                      className={cn(
                        "h-7 rounded-md px-2 text-[11px]",
                        bucket === item.key ? palette.accent : palette.ghost,
                      )}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <span
                className={cn(
                  "text-xs tabular-nums sm:justify-self-end",
                  palette.muted,
                )}
              >
                {filteredCount} {t.filtered} · {rangeLabel}
              </span>
            </div>

            <form
              className="flex min-w-0 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                applySearch();
              }}
              role="search"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  className={cn(
                    "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-75",
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
                    "h-9 w-full rounded-lg pl-9 text-sm",
                    palette.input,
                  )}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                size="icon-sm"
                className={cn("h-9 w-9 shrink-0 rounded-lg", palette.ghost)}
                aria-label={t.searchPlaceholder}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
