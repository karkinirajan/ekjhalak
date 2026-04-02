// lib/ingest/run.ts
// Main ingestion orchestrator.
// Called by POST /api/admin/ingest/run and by Supabase Cron.
//
// Strategy:
//  1. Load active sources from the static registry (DB sync is optional)
//  2. Fetch all RSS feeds in parallel with per-source isolation
//  3. Normalise → fingerprint → upsert to articles table
//  4. Mark duplicates / assign cluster keys
//  5. Enqueue translation jobs for English articles needing Nepali
//  6. Log ingest run + per-source errors

import sql from "@/lib/db";
import { ACTIVE_SOURCES } from "@/lib/source-registry";
import { fetchRssFeed } from "@/lib/rss-adapter";
import { normalizeStory } from "@/lib/feed-normalizer";
import { jaccardSimilarity } from "@/lib/deduplicator";
import type { Source } from "@/lib/source-registry";

const SOURCE_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT = 6;
const JACCARD_THRESHOLD = 0.65;
const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;

// ── DB availability guard ─────────────────────────────────────────────────────

function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ── Per-source ingest ─────────────────────────────────────────────────────────

interface SourceIngestResult {
  sourceId: string;
  ok: boolean;
  newItems: number;
  error?: string;
}

async function ingestSource(source: Source): Promise<SourceIngestResult> {
  if (!source.rssUrl) {
    return { sourceId: source.id, ok: false, newItems: 0, error: "No RSS URL" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);

    let rawStories;
    try {
      rawStories = await fetchRssFeed(source.rssUrl);
    } finally {
      clearTimeout(timer);
    }

    // Apply optional URL prefix filter
    const filtered = source.urlPrefix
      ? rawStories.filter((r) => r.url.startsWith(source.urlPrefix!))
      : rawStories;

    const items = filtered.map((raw) => normalizeStory(raw, source));

    if (!isDbAvailable()) {
      return { sourceId: source.id, ok: true, newItems: items.length };
    }

    let newCount = 0;

    for (const item of items) {
      try {
        const result = await sql`
          insert into articles (
            source_id, canonical_url, title_original, summary_original,
            image_url, published_at, fetched_at, language, category, fingerprint, score
          ) values (
            ${source.id},
            ${item.sourceUrl},
            ${item.title},
            ${item.summaryEn || null},
            ${item.imageUrl || null},
            ${new Date(item.publishedTimestamp)},
            ${new Date()},
            ${source.language},
            ${item.category || null},
            ${item.id},
            ${source.priority}
          )
          on conflict (fingerprint) do nothing
          returning id
        `;

        if (result.length > 0) {
          newCount++;
          // Enqueue translation job for English articles
          if (source.language === "en") {
            await sql`
              insert into translations (article_id, lang, status)
              values (${result[0].id}, 'np', 'pending')
              on conflict (article_id, lang) do nothing
            `;
          }
        }
      } catch (itemErr) {
        // Log item-level errors but don't fail the whole source
        console.error(
          `[ingest] item error for ${source.id}: ${itemErr instanceof Error ? itemErr.message : itemErr}`,
        );
      }
    }

    // Update last_fetched_at and last_success_at on the source
    await sql`
      update sources
      set last_fetched_at = now(), last_success_at = now(), last_error = null
      where id = ${source.id}
    `;

    return { sourceId: source.id, ok: true, newItems: newCount };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (isDbAvailable()) {
      await sql`
        update sources
        set last_fetched_at = now(), last_error = ${errorMsg}
        where id = ${source.id}
      `.catch(() => {});
    }

    return { sourceId: source.id, ok: false, newItems: 0, error: errorMsg };
  }
}

// ── Concurrency pool ──────────────────────────────────────────────────────────

async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number,
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;

  async function worker() {
    while (i < tasks.length) {
      const taskIndex = i++;
      results[taskIndex] = await tasks[taskIndex]();
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrent, tasks.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}

// ── Main ingest run ───────────────────────────────────────────────────────────

export interface IngestRunResult {
  runId: string | null;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  newItems: number;
  durationMs: number;
  errors: Array<{ sourceId: string; error: string }>;
}

export async function runIngest(trigger = "manual"): Promise<IngestRunResult> {
  const startedAt = Date.now();
  const sources = ACTIVE_SOURCES.filter((s) => s.rssUrl !== null);

  let runId: string | null = null;
  if (isDbAvailable()) {
    const runRow = await sql`
      insert into ingest_runs (interval_minutes, started_at)
      values (${parseInt(process.env.INGEST_INTERVAL_MINUTES ?? "15", 10)}, now())
      returning id
    `.catch(() => []);
    if (runRow.length > 0) runId = runRow[0].id;
  }

  const tasks = sources.map((source) => () => ingestSource(source));
  const results = await runConcurrent(tasks, MAX_CONCURRENT);

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const newItems = results.reduce((sum, r) => sum + r.newItems, 0);
  const durationMs = Date.now() - startedAt;

  if (isDbAvailable() && runId) {
    await sql`
      update ingest_runs
      set
        finished_at        = now(),
        sources_attempted  = ${sources.length},
        sources_succeeded  = ${succeeded.length},
        sources_failed     = ${failed.length},
        new_items          = ${newItems},
        notes              = ${trigger}
      where id = ${runId}
    `.catch(() => {});

    // Log individual source errors
    for (const r of failed) {
      await sql`
        insert into ingest_errors (source_id, run_id, stage, error_message)
        values (${r.sourceId}, ${runId}, 'fetch', ${r.error ?? "unknown"})
      `.catch(() => {});
    }
  }

  return {
    runId,
    sourcesAttempted: sources.length,
    sourcesSucceeded: succeeded.length,
    sourcesFailed: failed.length,
    newItems,
    durationMs,
    errors: failed.map((r) => ({ sourceId: r.sourceId, error: r.error ?? "" })),
  };
}
