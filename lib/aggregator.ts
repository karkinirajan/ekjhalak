// lib/aggregator.ts
// Orchestrates parallel RSS ingestion across all active sources.
// Results are cached with Next.js unstable_cache (5-minute revalidation).
// Server-only.

import { unstable_cache } from "next/cache";
import { ACTIVE_SOURCES } from "./source-registry";
import { fetchRssFeed } from "./rss-adapter";
import { normalizeStory } from "./feed-normalizer";
import { deduplicate } from "./deduplicator";
import { groqSummarize } from "./translator";
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

  // ── Original-language enrichment (summary only) ─
  // Processing happens here (inside the 5-min cache boundary) so LLM work is
  // done once per cache window, not on every request.
  const ENRICH_LIMIT = 1;
  const ENRICH_BUDGET_MS = 12_000;
  const enrichDeadline = Date.now() + ENRICH_BUDGET_MS;

  const needsEnrich = deduped.filter((item) => {
    const body = item.originalLang === "np" ? item.summaryNp : item.summaryEn;
    const hasBrief =
      item.originalLang === "np" ? !!item.briefNp : !!item.briefEn;
    return Boolean(body) && !hasBrief;
  });

  let enrichedCount = 0;
  for (const item of needsEnrich) {
    if (enrichedCount >= ENRICH_LIMIT) break;
    if (Date.now() > enrichDeadline) break;

    const sourceLang = item.originalLang;
    const sourceBody = sourceLang === "np" ? item.summaryNp : item.summaryEn;

    try {
      // Short brief in the ORIGINAL language only.
      const shortSummary = await groqSummarize(sourceBody, sourceLang);
      if (shortSummary && shortSummary !== sourceBody) {
        if (sourceLang === "np") item.briefNp = shortSummary;
        else item.briefEn = shortSummary;
      }

      enrichedCount++;
    } catch {
      // keep original content on any enrichment failure
    }
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
