"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { NewsCard } from "@/components/news-card";
import { PaginationBar } from "@/components/pagination-bar";
import { BrandImage } from "@/components/brand-image";
import { TopNavbar } from "@/components/top-navbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

import type { NewsItem, NewsFeedResponse, RangeKey } from "@/lib/news-pipeline";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 3 * 60 * 1000;

/** Range → lookback window in milliseconds (mirrors api/news/route.ts) */
const RANGE_CUTOFFS: Record<RangeKey, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

type LoadState = "idle" | "refreshing" | "error";

// ── Skeleton card ─────────────────────────────────────────────────────────────

interface SkeletonCardProps {
  palette: ReturnType<typeof useTheme>["palette"];
}

function SkeletonCard({ palette }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden animate-pulse",
        palette.card,
      )}
      aria-hidden="true"
    >
      <div className={cn("w-full h-36", palette.soft)} />
      <div className="p-4 space-y-2.5">
        <div className="flex gap-2">
          <div className={cn("h-4 w-16 rounded", palette.soft)} />
          <div className={cn("h-4 w-24 rounded", palette.soft)} />
        </div>
        <div className={cn("h-4 w-4/5 rounded", palette.soft)} />
        <div className={cn("h-3 w-full rounded", palette.soft)} />
        <div className={cn("h-3 w-5/6 rounded", palette.soft)} />
        <div className="flex gap-2 pt-1">
          <div className={cn("h-8 w-20 rounded-md", palette.soft)} />
          <div className={cn("h-8 w-16 rounded-md", palette.soft)} />
        </div>
      </div>
    </div>
  );
}

// ── NewsFeed component ────────────────────────────────────────────────────────

interface NewsFeedProps {
  initialData: NewsFeedResponse;
}

export function NewsFeed({ initialData }: NewsFeedProps) {
  const { palette, language, setLanguage, t, themeMode, setThemeMode } =
    useTheme();

  const [range, setRange] = useState<RangeKey>("day");
  const [bucket, setBucket] = useState<"all" | "national" | "international">(
    "all",
  );
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Start with server-rendered data — no loading state!
  const [items, setItems] = useState<NewsItem[]>(initialData.items);
  const [meta, setMeta] = useState<NewsFeedResponse["meta"]>(initialData.meta);
  const [loadState, setLoadState] = useState<LoadState>("idle");

  const feedTopRef = useRef<HTMLDivElement>(null);

  // ── Background refresh ──────────────────────────────────────────────────────
  // Fetches ALL items (widest range, all buckets) so local filtering stays instant.

  const fetchFeed = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadState("refreshing");
    try {
      const res = await fetch("/api/news?range=month&bucket=all&limit=500", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: NewsFeedResponse = await res.json();
      setItems(data.items);
      setMeta(data.meta);
      setLoadState("idle");
    } catch (err) {
      console.error("[feed] refresh error:", err);
      // Keep existing data — don't flash error if we already have content
      setLoadState("idle");
    }
  }, []);

  // If server returned empty data (cold start), immediately try client fetch
  useEffect(() => {
    if (initialData.items.length === 0) {
      fetchFeed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update document lang attribute so screen readers announce language correctly
  useEffect(() => {
    document.documentElement.lang = language === "np" ? "ne" : "en";
  }, [language]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [range, bucket, sourceFilter, language, search]);

  // Auto-refresh every 3 minutes (background)
  useEffect(() => {
    const id = setInterval(() => fetchFeed(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchFeed]);

  // ── Filtering (ALL client-side — range, bucket, source, search) ─────────────

  const applySearch = useCallback(() => {
    setSearch(searchDraft.trim());
  }, [searchDraft]);

  const filteredItems = useMemo(() => {
    let result = items;

    // Range filter (previously done server-side in /api/news)
    const cutoffMs = RANGE_CUTOFFS[range];
    const since = (meta?.fetchedAt ?? Date.now()) - cutoffMs;
    result = result.filter((item) => item.publishedTimestamp >= since);

    // Bucket filter (previously done server-side in /api/news)
    if (bucket === "national") {
      result = result.filter((item) => item.bucket === "national");
    } else if (bucket === "international") {
      result = result.filter((item) => item.bucket === "international");
    }

    // Source filter
    if (sourceFilter) {
      result = result.filter((item) => item.sourceId === sourceFilter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        [item.title, item.source, item.summaryEn, item.summaryNp]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    return result;
  }, [items, range, bucket, sourceFilter, search, meta?.fetchedAt]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // ── Pagination with scroll-to-top ───────────────────────────────────────────

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    feedTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const rangeLabel =
    range === "day"
      ? t.rangeDay
      : range === "week"
        ? t.rangeWeek
        : t.rangeMonth;

  const hasData = items.length > 0;
  const showSkeleton = !hasData && loadState === "refreshing";

  return (
    <div
      className={cn(
        "min-h-screen bg-linear-to-br flex",
        palette.app,
        palette.page,
      )}
    >
      {/* Sidebar — fixed, desktop only */}
      <aside
        className="hidden w-65 shrink-0 lg:flex flex-col fixed left-0 top-0 h-screen z-40"
        aria-label="Navigation and filters"
      >
        <AppSidebar
          range={range}
          setRange={setRange}
          bucket={bucket}
          setBucket={setBucket}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          sourceStatuses={meta?.sourceStatuses ?? []}
        />
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-65">
        <TopNavbar
          searchDraft={searchDraft}
          setSearchDraft={setSearchDraft}
          applySearch={applySearch}
          fetchFeed={fetchFeed}
          loadState={loadState}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          language={language}
          setLanguage={setLanguage}
          setMobileMenuOpen={setMobileMenuOpen}
          range={range}
          setRange={setRange}
          bucket={bucket}
          setBucket={setBucket}
          setSourceFilter={setSourceFilter}
          rangeLabel={rangeLabel}
          filteredCount={filteredItems.length}
          sourceFilter={sourceFilter}
          sourceFilterLabel={
            items.find((item) => item.sourceId === sourceFilter)?.source ?? null
          }
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-2 pt-2 lg:p-3">
          {/* Feed scroll anchor */}
          <div ref={feedTopRef} className="sr-only" aria-hidden="true" />

          {/* News feed card */}
          <Card className={cn("border rounded-md", palette.shell)}>
            <CardContent className="space-y-2 px-4 pt-4 pb-4">
              {/* Loading skeleton — only when we have NO data and are fetching */}
              {showSkeleton && (
                <div
                  className="space-y-2"
                  aria-label={t.loadingStories}
                  aria-busy="true"
                  role="status"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} palette={palette} />
                  ))}
                  <span className="sr-only">{t.loadingStories}</span>
                </div>
              )}

              {/* Error state — only when we have NO data */}
              {!hasData && loadState === "error" && (
                <div
                  className={cn(
                    "border border-dashed p-6 text-center text-sm rounded-md space-y-3",
                    palette.panel,
                    palette.muted,
                  )}
                  role="alert"
                >
                  <p>{t.errorFeed}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFeed(false)}
                    className={cn("rounded-md", palette.ghost)}
                  >
                    {t.retryLabel}
                  </Button>
                </div>
              )}

              {/* Feed items — rendered immediately with server data */}
              {!showSkeleton && (hasData || loadState === "idle") && (
                <>
                  {paginatedItems.length > 0 ? (
                    <div
                      role="feed"
                      aria-label={`${rangeLabel} ${t.rangeSuffix}`}
                      aria-busy={loadState === "refreshing"}
                      className="space-y-2"
                    >
                      {paginatedItems.map((item) => (
                        <NewsCard key={item.id} item={item} />
                      ))}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "border border-dashed p-6 text-center text-sm rounded-md",
                        palette.panel,
                        palette.muted,
                      )}
                      role="status"
                    >
                      {hasData ? t.noStories : t.loadingStories}
                    </div>
                  )}
                  <PaginationBar
                    page={safePage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <footer
            className={cn(
              "border px-4 py-4 text-xs mt-auto rounded-md",
              palette.panel,
            )}
          >
            <div className="flex items-center justify-center gap-6">
              <div className={cn("flex items-center gap-1.5", palette.muted)}>
                <span suppressHydrationWarning>
                  © {new Date().getFullYear()} एक झलक
                </span>
              </div>
              <div className={cn("flex items-center gap-1.5", palette.subtext)}>
                <span>Developed by</span>
                <a
                  href="https://kneeraazon.com"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn("font-medium hover:underline", palette.text)}
                >
                  Nirajan Karki
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile menu sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className={cn("w-70 p-0", palette.shell)}>
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <div
            className={cn(
              "flex flex-col h-full overflow-y-auto p-4 gap-3",
              palette.shell,
            )}
          >
            {/* Brand */}
            <BrandImage
              priority
              containerClassName="mt-3"
              imageClassName="max-h-18"
            />

            <Separator className="opacity-50" />

            {/* Language toggle */}
            <div>
              <div
                className={cn(
                  "mb-2 text-xs uppercase tracking-wide",
                  palette.muted,
                )}
              >
                {t.statLangTitle}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLanguage("en");
                    setMobileMenuOpen(false);
                  }}
                  aria-pressed={language === "en"}
                  className={cn(
                    "h-9 text-xs rounded-md",
                    language === "en" ? palette.accent : palette.ghost,
                  )}
                >
                  {t.tabEnFirst}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLanguage("np");
                    setMobileMenuOpen(false);
                  }}
                  aria-pressed={language === "np"}
                  className={cn(
                    "h-9 text-xs rounded-md",
                    language === "np" ? palette.accent : palette.ghost,
                  )}
                >
                  {t.tabNpFirst}
                </Button>
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Inline sidebar for mobile */}
            <AppSidebar
              range={range}
              setRange={(r) => {
                setRange(r);
                setMobileMenuOpen(false);
              }}
              bucket={bucket}
              setBucket={(b) => {
                setBucket(b);
                setMobileMenuOpen(false);
              }}
              sourceFilter={sourceFilter}
              setSourceFilter={(s) => {
                setSourceFilter(s);
                setMobileMenuOpen(false);
              }}
              sourceStatuses={meta?.sourceStatuses ?? []}
              compact
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
