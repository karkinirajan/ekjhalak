// lib/aggregator.ts
// Orchestrates parallel RSS ingestion across all active sources.
// Results are cached with Next.js unstable_cache (5-minute revalidation).
// Server-only.

import { unstable_cache } from "next/cache";
import { ACTIVE_SOURCES } from "./source-registry";
import { fetchRssFeed } from "./rss-adapter";
import { normalizeStory } from "./feed-normalizer";
import { deduplicate } from "./deduplicator";
import { batchTranslateToNepali, groqSummarize } from "./translator";
import type { NewsItem, SourceStatusMeta } from "./news-pipeline";
import type { Source } from "./source-registry";

export interface AggregatedFeed {
  /** All deduplicated stories, sorted newest-first */
  items: NewsItem[];
  /** Per-source fetch outcome */
  sourceStatuses: SourceStatusMeta[];
  /** Unix ms when this batch was assembled */
  fetchedAt: number;
}

// ── Per-source fetch ──────────────────────────────────────────────────────────

interface SourceResult {
  source: Source;
  items: NewsItem[];
  status: SourceStatusMeta;
}

async function fetchOneSource(source: Source): Promise<SourceResult> {
  const start = Date.now();

  if (!source.rssUrl) {
    return {
      source,
      items: [],
      status: {
        id: source.id,
        name: source.name,
        ok: false,
        itemCount: 0,
        fetchedAt: start,
        error: "No RSS URL configured",
      },
    };
  }

  try {
    const rawStories = await fetchRssFeed(source.rssUrl);

    // Apply optional URL prefix filter (e.g. CNN to remove sponsored ad entries)
    const filtered = source.urlPrefix
      ? rawStories.filter((raw) => raw.url.startsWith(source.urlPrefix!))
      : rawStories;

    const items = filtered.map((raw) => normalizeStory(raw, source));

    return {
      source,
      items,
      status: {
        id: source.id,
        name: source.name,
        ok: true,
        itemCount: items.length,
        fetchedAt: start,
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      source,
      items: [],
      status: {
        id: source.id,
        name: source.name,
        ok: false,
        itemCount: 0,
        fetchedAt: start,
        error,
      },
    };
  }
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Fetch all active sources in parallel and return a deduplicated feed.
 * One bad source does not affect the rest — errors are captured per-source.
 */
async function aggregateAllSources(): Promise<AggregatedFeed> {
  const fetchedAt = Date.now();

  // Sort by priority descending so high-priority sources win dedup ties
  const sourcesToFetch = [...ACTIVE_SOURCES].sort(
    (a, b) => b.priority - a.priority,
  );

  const results = await Promise.allSettled(
    sourcesToFetch.map((source) => fetchOneSource(source)),
  );

  const allItems: NewsItem[] = [];
  const sourceStatuses: SourceStatusMeta[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
      sourceStatuses.push(result.value.status);
    } else {
      // This branch should rarely occur since fetchOneSourc catches internally
      console.error("[aggregator] Unexpected rejection:", result.reason);
    }
  }

  // Sort all items newest-first before deduplication
  // (dedup keeps the first occurrence = highest-priority source's version)
  allItems.sort((a, b) => b.publishedTimestamp - a.publishedTimestamp);

  const deduped = deduplicate(allItems);

  // ── Summarize long English summaries via Groq ──────────────────────────────
  // Only items that don't already have native Nepali content need translation.
  // Processing happens here (inside the cache boundary) so translations are
  // computed once per 5-minute cache window, not on every request.
  // Budget: 20s for summarization. Each groqSummarize call has its own 15s
  // AbortSignal timeout, but the loop is sequential — cap the total.
  const SUMMARIZE_BUDGET_MS = 20_000;
  const summarizeDeadline = Date.now() + SUMMARIZE_BUDGET_MS;
  for (const item of deduped) {
    if (Date.now() > summarizeDeadline) break;
    if (item.summaryEn && item.summaryEn.split(/\s+/).length > 160) {
      try {
        item.summaryEn = await groqSummarize(item.summaryEn);
      } catch {
        // keep original if summarization fails
      }
    }
  }

  // ── Translate titles and summaries to Nepali ───────────────────────────────
  const toTranslate = deduped.filter(
    (item) => item.summaryEn && !item.summaryNp,
  );
  if (toTranslate.length > 0) {
    // Translate titles
    const titlesToTranslate = toTranslate.filter(
      (item) => item.title && !item.titleNp,
    );
    if (titlesToTranslate.length > 0) {
      const titleTranslations = await batchTranslateToNepali(
        titlesToTranslate.map((item) => item.title),
        1,
      );
      titlesToTranslate.forEach((item, i) => {
        if (titleTranslations[i]) item.titleNp = titleTranslations[i];
      });
    }

    // Translate summaries
    const translations = await batchTranslateToNepali(
      toTranslate.map((item) => item.summaryEn),
      1, // sequential to avoid rate-limiting on free tier
    );
    toTranslate.forEach((item, i) => {
      if (translations[i]) item.summaryNp = translations[i];
    });
  }

  return { items: deduped, sourceStatuses, fetchedAt };
}

// ── Cached export ─────────────────────────────────────────────────────────────

/**
 * Cached version of aggregateAllSources.
 * Cache is shared across all requests for the revalidation window.
 * Tagged "news-feed" so it can be invalidated on-demand via revalidateTag().
 */
export const getCachedFeed = unstable_cache(
  aggregateAllSources,
  ["aggregated-news-feed"],
  {
    revalidate: 300, // 5 minutes — balances freshness vs. source load
    tags: ["news-feed"],
  },
);
