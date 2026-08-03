// lib/aggregator.ts
// Parallel RSS ingestion across all active sources.
// Output is cached with Next.js unstable_cache (5-minute revalidation).
// Server-only.

import { unstable_cache } from "next/cache";
import { ACTIVE_SOURCES } from "./source-registry";
import { fetchRssFeed } from "./rss-adapter";
import { normalizeStory } from "./feed-normalizer";
import { deduplicate } from "./deduplicator";
import { scoreStory } from "./ranking";
import {
  enrichStories,
  isEnrichmentConfigured,
  looksLikeBoilerplate,
  hardTruncateSummary,
  SUMMARY_MAX_CHARS,
  type EnrichInput,
  type EnrichResult,
} from "./summarizer";
import {
  enrichmentKey,
  readEnrichment,
  writeEnrichment,
} from "./enrichment-cache";
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

  await enrichFeed(deduped, fetchedAt);

  return { items: deduped, sourceStatuses, fetchedAt };
}

/**
 * How long one regeneration may spend at the model.
 *
 * The old value was 12 seconds, chosen against a since-raised 60-second Vercel
 * limit and against a pipeline that made one request per story. This pass makes
 * one request per ten stories and has translation to do as well, so the ceiling
 * moved and the work it buys moved further: 12 seconds now covers several
 * batches rather than a handful of individual stories.
 *
 * Whatever the budget does not reach keeps its cached enrichment or its
 * deterministic fallback, and the next regeneration picks up where this one
 * stopped — so this is a latency control, not a quality one.
 */
const ENRICH_BUDGET_MS = Number.parseInt(
  process.env.GEMINI_BUDGET_MS ?? "25000",
  10,
);

/**
 * Rewrite and translate every story, best stories first.
 *
 * Ordering by newsworthiness is load-bearing. The free-tier quota means a cold
 * feed cannot be fully enriched in one pass, so *which* stories a pass reaches
 * decides what the reader sees — and the reader sees the front page. Sorting
 * candidates by the same score that ranks the grid means the budget is spent on
 * the cards above the fold, and the tail fills in over subsequent passes.
 */
async function enrichFeed(items: NewsItem[], now: number): Promise<void> {
  const pending: Array<{ item: NewsItem; key: string; input: EnrichInput }> = [];
  const enriched = new Set<string>();

  for (const item of items) {
    // Nothing to work from. The headline is the whole story for these, and
    // asking a model to expand a headline is asking it to invent.
    if (!item.summary) continue;

    const key = enrichmentKey(item.id, item.summary);
    const cached = readEnrichment(key);
    if (cached) {
      applyEnrichment(item, cached);
      enriched.add(item.id);
      continue;
    }

    pending.push({
      item,
      key,
      input: {
        id: item.id,
        title: item.title,
        body: item.summary,
        lang: item.originalLang,
      },
    });
  }

  if (pending.length > 0 && isEnrichmentConfigured()) {
    pending.sort((a, b) => scoreStory(b.item, now) - scoreStory(a.item, now));

    try {
      const results = await enrichStories(
        pending.map((entry) => entry.input),
        Date.now() + ENRICH_BUDGET_MS,
      );

      for (const entry of pending) {
        const result = results.get(entry.item.id);
        if (!result) continue;
        writeEnrichment(entry.key, result);
        applyEnrichment(entry.item, result);
        enriched.add(entry.item.id);
      }
    } catch (err) {
      console.warn("[aggregator] enrichment pass failed:", err);
    }
  }

  // Last line of defence for everything the pass did not reach: never let the
  // UI render a raw RSS body.
  //
  // Truncating publisher chrome just yields shorter publisher chrome, so if the
  // model could not turn it into news, drop it. The card renders headline only,
  // which is the honest outcome — a story we have no summary for is better shown
  // as a headline than as somebody's subscription pitch.
  for (const item of items) {
    if (enriched.has(item.id)) continue;
    item.summary = looksLikeBoilerplate(item.summary)
      ? ""
      : hardTruncateSummary(item.summary, SUMMARY_MAX_CHARS);
  }
}

/**
 * The publisher's own headline is never replaced.
 *
 * It is the one string in the item we are most confident is accurate, it is what
 * the reader will see again if they follow the link, and a model rewrite buys
 * nothing the summary underneath it does not already deliver. Only the
 * *translated* headline comes from the model, because there is no other source
 * for one.
 */
function applyEnrichment(item: NewsItem, result: EnrichResult): void {
  item.summary = result.summary;
  if (result.titleTranslated) item.titleTranslated = result.titleTranslated;
  if (result.summaryTranslated) {
    item.summaryTranslated = result.summaryTranslated;
  }
}

export const getCachedFeed = unstable_cache(
  aggregateAllSources,
  ["aggregated-news-feed"],
  {
    revalidate: 300,
    tags: ["news-feed"],
  },
);
