"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BreakingTicker } from "@/components/breaking-ticker";
import {
  CategoryNav,
  type BucketFilter,
  type TopicFilter,
} from "@/components/category-nav";
import { FeedClockProvider } from "@/components/feed-clock";
import { Masthead } from "@/components/masthead";
import { NewsletterCta } from "@/components/newsletter-cta";
import { PaginationBar } from "@/components/pagination-bar";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { StoryCard } from "@/components/story-card";
import { StoryHero } from "@/components/story-hero";
import { StoryReader } from "@/components/story-reader";
import { TrendingRail } from "@/components/trending-rail";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import {
  diversifyBySource,
  selectHero,
  selectTicker,
  selectTrending,
} from "@/lib/ranking";
import type { TopicId } from "@/lib/taxonomy";
import type { NewsItem, NewsFeedResponse, RangeKey } from "@/lib/news-pipeline";

const PAGE_SIZE = 12;
const REFRESH_INTERVAL_MS = 3 * 60 * 1000;

const RANGE_CUTOFFS: Record<RangeKey, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

type LoadState = "idle" | "refreshing" | "error";

function GridSkeleton() {
  return (
    <div
      className="grid gap-6 sm:grid-cols-2"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-rule bg-surface"
        >
          <div className="aspect-[16/10] w-full animate-pulse bg-raised" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-raised" />
            <div className="h-5 w-11/12 animate-pulse rounded bg-raised" />
            <div className="h-4 w-full animate-pulse rounded bg-raised" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface NewsFeedProps {
  initialData: NewsFeedResponse;
  /** How many stories to request on refresh — matches the server's payload cap */
  limit?: number;
}

export function NewsFeed({ initialData, limit = 180 }: NewsFeedProps) {
  const { t, language } = useTheme();
  const isNp = language === "np";

  const [range, setRange] = useState<RangeKey>("day");
  const [bucket, setBucket] = useState<BucketFilter>("all");
  const [topic, setTopic] = useState<TopicFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<NewsItem[]>(initialData.items);
  const [meta, setMeta] = useState<NewsFeedResponse["meta"]>(initialData.meta);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [activeStory, setActiveStory] = useState<NewsItem | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);

  const latestRef = useRef<HTMLDivElement>(null);
  const newsletterRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoadState("refreshing");
      try {
        const res = await fetch(
          `/api/news?range=month&bucket=all&limit=${limit}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: NewsFeedResponse = await res.json();
        setItems(data.items);
        setMeta(data.meta);
        setLoadState("idle");
      } catch (err) {
        console.error("[feed] refresh error:", err);
        // Keep whatever is already on screen — a stale story beats an error page.
        setLoadState((current) =>
          current === "refreshing" ? "error" : current,
        );
      }
    },
    [limit],
  );

  useEffect(() => {
    // Server render produced nothing (feed was cold or the aggregator failed) —
    // recover on the client rather than showing an empty page.
    if (initialData.items.length === 0) {
      startTransition(() => {
        void fetchFeed(false);
      });
    }
  }, [fetchFeed, initialData.items.length]);

  // Background refresh, with two things it deliberately will not do.
  //
  // It will not fire while a story is open. Replacing `items` re-runs every
  // ranking selection, so the hero, the grid, the trending rail and the current
  // page all change at once — and that was happening underneath readers with the
  // panel open, which meant coming back from a story to a page that no longer
  // held the story you came from.
  //
  // It will not fire in a backgrounded tab either. A tab left open all day was
  // pulling the feed every three minutes whether or not anyone was looking at
  // it. On becoming visible again it refreshes once, immediately, so returning
  // to the tab still shows current news rather than whatever was there at lunch.
  useEffect(() => {
    if (readerOpen) return;

    const tick = () => {
      if (document.visibilityState === "visible") void fetchFeed(true);
    };

    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [fetchFeed, readerOpen]);

  // Every filter change returns to page 1. Done in the setters rather than an
  // effect on [range, bucket, topic, search]: the reset is a direct consequence
  // of the reader's click, not something to re-derive after the fact.
  const selectRange = useCallback((value: RangeKey) => {
    setRange(value);
    setPage(1);
  }, []);

  const selectBucket = useCallback((value: BucketFilter) => {
    setBucket(value);
    setPage(1);
  }, []);

  const selectTopic = useCallback((value: TopicFilter) => {
    setTopic(value);
    setPage(1);
  }, []);

  const applySearch = useCallback(() => {
    setSearch(searchDraft.trim());
    setPage(1);
  }, [searchDraft]);

  const resetFilters = useCallback(() => {
    setTopic("all");
    setBucket("all");
    setSearch("");
    setSearchDraft("");
    setPage(1);
  }, []);

  const openStory = useCallback((item: NewsItem) => {
    setActiveStory(item);
    setReaderOpen(true);
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────────
  // Range/region/search narrow the pool that everything else is computed from.
  // Topic is applied separately so the category counts can show what selecting
  // each topic would actually yield.

  // Range filtering is measured from the fetch time, never from a live clock:
  // Date.now() during render disagrees between server and client and breaks
  // hydration. Items arrive newest-first, so the freshest story is the fallback
  // reference when meta is missing; if both are absent `since` goes negative and
  // everything shows, which is the right way to fail.
  const referenceTime = meta?.fetchedAt || items[0]?.publishedTimestamp || 0;

  const scopedItems = useMemo(() => {
    const since = referenceTime - RANGE_CUTOFFS[range];
    let result = items.filter((item) => item.publishedTimestamp >= since);

    if (bucket !== "all") {
      result = result.filter((item) => item.bucket === bucket);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((item) =>
        `${item.title} ${item.summary} ${item.sourceName}`
          .toLowerCase()
          .includes(query),
      );
    }

    return result;
  }, [items, range, bucket, search, referenceTime]);

  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of scopedItems) {
      counts[item.topic] = (counts[item.topic] ?? 0) + 1;
    }
    return counts;
  }, [scopedItems]);

  const filteredItems = useMemo(
    () =>
      topic === "all"
        ? scopedItems
        : scopedItems.filter((item) => item.topic === topic),
    [scopedItems, topic],
  );

  // ── Editorial layout selection ────────────────────────────────────────────

  const { lead, side, rest } = useMemo(
    () => selectHero(filteredItems, 3, referenceTime),
    [filteredItems, referenceTime],
  );

  const trending = useMemo(() => {
    const shown = new Set<string>(
      [lead, ...side].filter((item): item is NewsItem => Boolean(item)).map((item) => item.id),
    );
    // The rail always ranks across the whole scoped pool, not the topic-filtered
    // slice — otherwise picking "Sports" makes "most covered" mean nothing.
    return selectTrending(scopedItems, shown, 6, referenceTime);
  }, [scopedItems, lead, side, referenceTime]);

  const tickerItems = useMemo(
    () => selectTicker(items, 8, referenceTime),
    [items, referenceTime],
  );

  // Reordered so one newsroom's publishing burst can't fill a whole page.
  const latestItems = useMemo(() => diversifyBySource(rest), [rest]);

  const totalPages = Math.max(1, Math.ceil(latestItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = latestItems.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const handlePageChange = useCallback((next: number) => {
    setPage(next);
    latestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleFooterTopic = useCallback(
    (next: TopicId) => {
      selectTopic(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [selectTopic],
  );

  const sourceCount = useMemo(
    () => meta?.sourceStatuses.filter((status) => status.ok).length ?? 0,
    [meta?.sourceStatuses],
  );

  const hasData = items.length > 0;
  const showSkeleton = !hasData && loadState === "refreshing";
  const showEmpty = hasData && filteredItems.length === 0;

  return (
    <FeedClockProvider value={referenceTime}>
      <div className="min-h-screen bg-canvas">
        <BreakingTicker items={tickerItems} fetchedAt={meta?.fetchedAt ?? 0} />

        <Masthead
          searchDraft={searchDraft}
          setSearchDraft={setSearchDraft}
          applySearch={applySearch}
          onRefresh={() => fetchFeed(false)}
          isRefreshing={loadState === "refreshing"}
          onSubscribe={() =>
            newsletterRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            })
          }
        />

        <CategoryNav
          topic={topic}
          setTopic={selectTopic}
          bucket={bucket}
          setBucket={selectBucket}
          range={range}
          setRange={selectRange}
          topicCounts={topicCounts}
          resultCount={filteredItems.length}
        />

        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {showSkeleton && <GridSkeleton />}

          {!hasData && loadState === "error" && (
            <div
              role="alert"
              className="rounded-lg border border-dashed border-rule-strong bg-surface px-6 py-16 text-center"
            >
              <p className={cn("text-ink-soft", isNp && "font-np")}>
                {t.errorFeed}
              </p>
              <button
                type="button"
                onClick={() => fetchFeed(false)}
                className={cn(
                  "mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-85",
                  isNp && "font-np",
                )}
              >
                {t.retryLabel}
              </button>
            </div>
          )}

          {hasData && (
            <div className="space-y-12">
              <StoryHero lead={lead} side={side} onOpen={openStory} />

              {showEmpty && (
                <div
                  role="status"
                  className="rounded-lg border border-dashed border-rule-strong bg-surface px-6 py-16 text-center"
                >
                  <p className={cn("text-ink-soft", isNp && "font-np")}>
                    {t.noStories}
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className={cn(
                      "mt-5 rounded-full border border-rule-strong px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-raised",
                      isNp && "font-np",
                    )}
                  >
                    {t.clearFilters}
                  </button>
                </div>
              )}

              {/* ── Latest grid + trending rail ──────────────────────────── */}
              {rest.length > 0 && (
                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
                  <section aria-label={t.latestSection}>
                    <div
                      ref={latestRef}
                      className="mb-6 flex scroll-mt-32 items-center gap-4"
                    >
                      <h2
                        className={cn(
                          "text-2xl font-bold tracking-tight text-ink",
                          isNp ? "font-np" : "font-display",
                        )}
                      >
                        {t.latestSection}
                      </h2>
                      <span className="h-px flex-1 bg-rule" />
                      <span className="eyebrow tabular-nums text-ink-muted">
                        {rest.length}
                      </span>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      {pagedItems.map((item, index) => (
                        <Reveal key={item.id} delay={Math.min(index, 5) * 60}>
                          <StoryCard item={item} onOpen={openStory} />
                        </Reveal>
                      ))}
                    </div>

                    <div className="mt-8">
                      <PaginationBar
                        page={safePage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                      />
                    </div>
                  </section>

                  <TrendingRail items={trending} onOpen={openStory} />
                </div>
              )}

              <div ref={newsletterRef} className="scroll-mt-32">
                <Reveal>
                  <NewsletterCta />
                </Reveal>
              </div>
            </div>
          )}
        </div>

        <SiteFooter sourceCount={sourceCount} onTopicSelect={handleFooterTopic} />

        <StoryReader
          item={activeStory}
          open={readerOpen}
          onOpenChange={setReaderOpen}
        />
      </div>
    </FeedClockProvider>
  );
}
