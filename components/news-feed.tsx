"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { NewsCard } from "@/components/news-card";
import { PaginationBar } from "@/components/pagination-bar";
import { TopNavbar } from "@/components/top-navbar";

import type { NewsItem, NewsFeedResponse, RangeKey } from "@/lib/news-pipeline";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 3 * 60 * 1000;

const RANGE_CUTOFFS: Record<RangeKey, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

type LoadState = "idle" | "refreshing" | "error";

interface SkeletonCardProps {
  palette: ReturnType<typeof useTheme>["palette"];
}

function SkeletonCard({ palette }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "border rounded-2xl overflow-hidden animate-pulse",
        palette.card,
      )}
      aria-hidden="true"
    >
      <div className="p-5 space-y-2.5">
        <div className={cn("h-4 w-4/5 rounded", palette.soft)} />
        <div className={cn("h-3 w-full rounded", palette.soft)} />
        <div className={cn("h-3 w-5/6 rounded", palette.soft)} />
        <div className={cn("h-8 w-20 rounded-md mt-1", palette.soft)} />
      </div>
    </div>
  );
}

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
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<NewsItem[]>(initialData.items);
  const [meta, setMeta] = useState<NewsFeedResponse["meta"]>(initialData.meta);
  const [loadState, setLoadState] = useState<LoadState>("idle");

  const feedTopRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(
    async (isBackground = false) => {
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
        setLoadState(items.length > 0 ? "idle" : "error");
      }
    },
    [items.length],
  );

  useEffect(() => {
    if (initialData.items.length === 0) {
      fetchFeed(false);
    }
  }, [fetchFeed, initialData.items.length]);

  useEffect(() => {
    document.documentElement.lang = language === "np" ? "ne" : "en";
  }, [language]);

  useEffect(() => {
    setPage(1);
  }, [range, bucket, language, search]);

  useEffect(() => {
    const id = setInterval(() => fetchFeed(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchFeed]);

  const applySearch = useCallback(() => {
    setSearch(searchDraft.trim());
  }, [searchDraft]);

  const filteredItems = useMemo(() => {
    let result = items;

    const cutoffMs = RANGE_CUTOFFS[range];
    const since = (meta?.fetchedAt ?? Date.now()) - cutoffMs;
    result = result.filter((item) => item.publishedTimestamp >= since);

    if (bucket !== "all") {
      result = result.filter((item) => item.bucket === bucket);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        `${item.title} ${item.summary}`.toLowerCase().includes(q),
      );
    }

    return result;
  }, [items, range, bucket, search, meta?.fetchedAt]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

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
    <div className={cn("min-h-screen", palette.app)}>
      <div className="mx-auto flex min-h-screen w-full min-w-0 flex-1 flex-col px-3 sm:w-[94vw] sm:max-w-[1280px] lg:px-4">
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
          range={range}
          setRange={setRange}
          bucket={bucket}
          setBucket={setBucket}
          rangeLabel={rangeLabel}
          filteredCount={filteredItems.length}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4 pt-0 pb-3">
          <div ref={feedTopRef} className="sr-only" aria-hidden="true" />

          <Card
            className={cn(
              "border-x border-b border-t-0 rounded-b-2xl rounded-t-none",
              palette.shell,
            )}
          >
            <CardContent className="space-y-2 px-3 pt-4 pb-4 sm:px-5">
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

              {!hasData && loadState === "error" && (
                <div
                  className={cn(
                    "border border-dashed p-6 text-center text-sm rounded-xl space-y-3",
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
                    className={cn("rounded-xl", palette.ghost)}
                  >
                    {t.retryLabel}
                  </Button>
                </div>
              )}

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
                        "border border-dashed p-6 text-center text-sm rounded-xl",
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

          <footer
            className={cn(
              "mt-auto rounded-2xl border px-5 py-4",
              palette.panel,
            )}
          >
            <div className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <p className={cn("text-xs", palette.muted)} suppressHydrationWarning>
                © {new Date().getFullYear()} EkJhalak News
              </p>
              <p className={cn("text-xs", palette.muted)}>
                Developed by{" "}
                <a
                  href="https://kneeraazon.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "font-medium underline-offset-4 hover:underline",
                    palette.subtext,
                  )}
                >
                  kneeraazon
                </a>
                {" · "}
                <a
                  href="https://kneeraazon.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "underline-offset-4 hover:underline",
                    palette.subtext,
                  )}
                >
                  kneeraazon.com
                </a>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
