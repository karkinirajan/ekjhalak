// lib/aggregator.ts
// Parallel RSS ingestion across all active sources.
// Output is cached with Next.js unstable_cache (5-minute revalidation).
// Server-only.

import { unstable_cache } from "next/cache";
import { ACTIVE_SOURCES } from "./source-registry";
import { fetchRssFeed } from "./rss-adapter";
import { normalizeStory } from "./feed-normalizer";
import { deduplicate } from "./deduplicator";
import {
  summarize,
  isSummaryAcceptable,
  hardTruncateSummary,
  SUMMARY_MAX_CHARS,
} from "./summarizer";
import type { NewsItem, SourceStatusMeta } from "./news-pipeline";
import type { Source } from "./source-registry";

export interface AggregatedFeed {
  items: NewsItem[];
  sourceStatuses: SourceStatusMeta[];
  fetchedAt: number;
}

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
    return {
      source,
      items: [],
      status: {
        id: source.id,
        name: source.name,
        ok: false,
        itemCount: 0,
        fetchedAt: start,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function aggregateAllSources(): Promise<AggregatedFeed> {
  const fetchedAt = Date.now();

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
    }
  }

  allItems.sort((a, b) => b.publishedTimestamp - a.publishedTimestamp);
  const deduped = deduplicate(allItems);

  // Original-language summarization — one LLM call per item, budgeted so the
  // function does not exceed Vercel's 60-second static-generation window.
  const ENRICH_BUDGET_MS = 12_000;
  const deadline = Date.now() + ENRICH_BUDGET_MS;

  for (const item of deduped) {
    if (!item.summary) continue;
    if (isSummaryAcceptable(item.summary)) continue;

    if (Date.now() <= deadline) {
      try {
        const brief = await summarize(item.summary, item.originalLang);
        if (brief && isSummaryAcceptable(brief)) {
          item.summary = brief;
          continue;
        }
      } catch {
        // fall through to the deterministic hard cap below
      }
    }

    // Last-line-of-defense: never let the UI render a raw RSS body.
    item.summary = hardTruncateSummary(item.summary, SUMMARY_MAX_CHARS);
  }

  return { items: deduped, sourceStatuses, fetchedAt };
}

export const getCachedFeed = unstable_cache(
  aggregateAllSources,
  ["aggregated-news-feed"],
  {
    revalidate: 300,
    tags: ["news-feed"],
  },
);
