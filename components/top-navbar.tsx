"use client";

import {
  Languages,
  Menu,
  MoonStar,
  RefreshCw,
  Search,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandImage } from "@/components/brand-image";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import type { RangeKey } from "@/lib/news-pipeline";

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
  setMobileMenuOpen: (value: boolean) => void;
  range: RangeKey;
  setRange: (value: RangeKey) => void;
  bucket: BucketFilter;
  setBucket: (value: BucketFilter) => void;
  setSourceFilter: (value: string | null) => void;
  rangeLabel: string;
  filteredCount: number;
  sourceFilter: string | null;
  sourceFilterLabel: string | null;
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
  setMobileMenuOpen,
  range,
  setRange,
  bucket,
  setBucket,
  setSourceFilter,
  rangeLabel,
  filteredCount,
  sourceFilter,
  sourceFilterLabel,
}: TopNavbarProps) {
  const { palette, t } = useTheme();

  return (
    <div className="sticky top-0 z-50 -mx-2 lg:-mx-3">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 bottom-0 border-x-0 border-t-0 rounded-none backdrop-blur-md shadow-sm",
          palette.shell,
        )}
      />
      <div className="relative">
        <div className="px-4 pt-3 pb-2 sm:pt-4">
          <div className="flex flex-col gap-3">
            <BrandImage
              priority
              containerClassName="mt-1 min-h-20 lg:hidden"
              imageClassName="max-h-16 sm:max-h-20"
            />

            <div className="flex flex-col gap-2 lg:hidden">
              <div className="flex flex-col gap-1">
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
                      className={cn(
                        "h-8 rounded-md text-xs",
                        range === item.key ? palette.accent : palette.ghost,
                      )}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wide",
                    palette.muted,
                  )}
                >
                  {t.statFeedTitle}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
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
                      onClick={() => {
                        setBucket(item.key);
                        setSourceFilter(null);
                      }}
                      className={cn(
                        "h-8 rounded-md text-xs",
                        bucket === item.key ? palette.accent : palette.ghost,
                      )}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden gap-4 lg:flex lg:flex-col xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle
                  className={cn("text-lg font-semibold", palette.text)}
                >
                  {rangeLabel} {t.rangeSuffix}
                </CardTitle>
                <CardDescription
                  className={cn("mt-0.5 text-sm", palette.muted)}
                >
                  {t.briefingDesc}
                </CardDescription>
              </div>

              <div
                className={cn(
                  "flex flex-wrap items-center gap-6 border-l pl-6 md:border-l-0 md:pl-0",
                  palette.muted,
                )}
              >
                <div className="flex flex-col">
                  <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                    {t.statItemsTitle}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      palette.text,
                    )}
                  >
                    {filteredCount}
                  </div>
                </div>
                <div className="h-6 w-px bg-border opacity-50" />
                <div className="flex flex-col">
                  <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                    {t.statTimelineTitle}
                  </div>
                  <div className={cn("text-xs font-medium", palette.text)}>
                    {rangeLabel}
                  </div>
                </div>
                <div className="h-6 w-px bg-border opacity-50" />
                <div className="flex flex-col">
                  <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                    {t.statFeedTitle}
                  </div>
                  <div className={cn("text-xs font-medium", palette.text)}>
                    {bucket === "national"
                      ? t.sectionNepal
                      : bucket === "international"
                        ? t.sectionInternational
                        : t.feedAll}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full items-center justify-end gap-2">
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  applySearch();
                }}
              >
                <div className="relative flex-1 min-w-0">
                  <Search
                    className={cn(
                      "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                      palette.muted,
                    )}
                  />
                  <Input
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className={cn(
                      "h-8 w-full rounded-md pl-9 text-sm",
                      palette.input,
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  size="icon-sm"
                  className={cn("shrink-0 rounded-md", palette.ghost)}
                  aria-label="Search news"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </form>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => fetchFeed(false)}
                disabled={loadState === "loading" || loadState === "refreshing"}
                className={cn("shrink-0 rounded-md", palette.ghost)}
                aria-label="Refresh feed"
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    (loadState === "loading" || loadState === "refreshing") &&
                      "animate-spin",
                  )}
                />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  setThemeMode(themeMode === "dark" ? "light" : "dark")
                }
                className={cn("shrink-0 rounded-md", palette.ghost)}
                aria-label={themeMode === "dark" ? t.themeLight : t.themeDark}
              >
                {themeMode === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <MoonStar className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLanguage(language === "en" ? "np" : "en")}
                className={cn("hidden h-8 shrink-0 sm:flex", palette.ghost)}
              >
                <Languages className="mr-1.5 h-4 w-4" />
                {t.langButton}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setMobileMenuOpen(true)}
                className={cn("shrink-0 rounded-md lg:hidden", palette.ghost)}
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>

            {sourceFilter && (
              <div
                className={cn("flex items-center gap-2 text-xs", palette.muted)}
              >
                <span>Filtered by source:</span>
                <span className={cn("font-medium", palette.text)}>
                  {sourceFilterLabel ?? sourceFilter}
                </span>
                <button
                  onClick={() => setSourceFilter(null)}
                  className={cn(
                    "underline underline-offset-2 hover:no-underline",
                    palette.muted,
                  )}
                  aria-label="Clear source filter"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
