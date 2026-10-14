// lib/article-store.ts
// The archive, as transport. Server-only.
//
// Three properties this module must never violate, in order:
//
//   1. The feed works without it. Unset env vars, an unreachable database, a
//      schema mismatch, a 500 from PostgREST — every one of them is a warning in
//      the logs and nothing else. `/api/news` still builds from RSS.
//   2. It cannot spend the pass's budget. The regeneration that runs on the
//      request path has already been taken down twice by a stage that started
//      work without asking how much time was left (see audit/recon.md, D3). Every
//      call here takes a deadline and clamps its own timeout to it.
//   3. A read is an optimisation, never a dependency. Every read returns empty
//      on failure, and every caller must still be correct when it does.
//
// What to send and what to make of what comes back lives in lib/article-rows.ts.
// This file is HTTP, credentials and clocks.
//
// No supabase-js. This is authenticated HTTP against PostgREST; the client
// library would add a dependency, a bundle, and a connection lifecycle to a
// module that needs none of them. The rest of this codebase parses RSS and
// extracts article bodies by hand for the same reason.

// Build-time guard: importing this from a client component is a build
// error rather than a shipped bundle. Reads SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
import "server-only";

import {
  fromRow,
  partitionForWrite,
  STORY_SELECT,
  type CoreRow,
  type EnrichedRow,
  type StoredArticleRow,
} from "./article-rows";
import type { NewsItem, StoryQuality } from "./news-pipeline";
import { isDbConfigured, query } from "./db";

/**
 * The REST origin, under either name.
 *
 * The store is a Postgres connection, configured by DATABASE_URL alone.
 *
 * It used to be Supabase over PostgREST, reached by SUPABASE_URL with
 * NEXT_PUBLIC_SUPABASE_URL accepted alongside it — a latitude that was safe for
 * the origin and never extended to the key. All of that is gone: the origin was
 * an HTTPS endpoint and this is a socket to a database on the same machine.
 *
 * DATABASE_URL was already in this file, read only to recover a project ref for
 * an error message. It is the connection now, which is what the name always
 * said it was.
 */
export function isStoreConfigured(): boolean {
  return isDbConfigured();
}

/**
 * Rows per INSERT.
 *
 * One statement either way, so this is about statement size rather than round
 * trips. Postgres binds one parameter per column per row — 500 rows of 17
 * columns is 8,500 parameters, comfortably under the 65,535 ceiling — and a
 * failure loses one batch rather than the pass.
 */
const WRITE_BATCH = 500;

/**
 * Ids per read.
 *
 * The URL-length reason this number had under PostgREST is gone — the ids now
 * travel as one array parameter, not in a query string. It is kept because the
 * other reason still holds: a chunk that times out costs only its own stories a
 * model request, so smaller chunks fail smaller.
 */
const READ_CHUNK = 120;

/** Ceiling on the whole write, however much of the pass is left. */
const WRITE_TIMEOUT_MS = 5_000;

/** Ceiling on one read round-trip. Shorter: a read is an optimisation. */
const READ_TIMEOUT_MS = 3_000;

/**
 * Ids are SHA-256 prefixes.
 *
 * Queries are parameterised now, so this is no longer what stands between a
 * crafted id and the database. It stays as a cheap correctness filter: an id
 * that cannot be one of ours is not worth a round trip.
 */
const ID_PATTERN = /^[0-9a-f]{6,64}$/i;

// ── Observability ───────────────────────────────────────────────────────────
//
// This module swallows its own failures by design — property 1 above — and that
// design is exactly why nobody noticed the archive had never written a single
// row. A warning in a serverless log nobody tails is indistinguishable from
// silence.
//
// So the outcome is recorded as well as logged, and app/api/archive/route.ts
// reports it. The counters are per-instance and reset on every cold start, which
// makes them useless as totals and perfectly good as the thing they are for:
// answering "did the most recent write on this instance succeed, and if not,
// what did PostgREST actually say".

export interface ArchiveStatus {
  configured: boolean;
  /** Which env var supplied the origin — the mismatch that keeps happening. */
  /** Which variable configured the store, or null when none did. */
  originFrom: "DATABASE_URL" | null;
  lastWriteAt: string | null;
  lastWriteRows: number;
  lastError: string | null;
  lastErrorAt: string | null;
  writesOk: number;
  writesFailed: number;
  rowsWritten: number;
  hydrateHits: number;
  hydrateMisses: number;
}

const stats = {
  lastWriteAt: 0,
  lastWriteRows: 0,
  lastError: null as string | null,
  lastErrorAt: 0,
  writesOk: 0,
  writesFailed: 0,
  rowsWritten: 0,
  hydrateHits: 0,
  hydrateMisses: 0,
};

export function archiveStatus(): ArchiveStatus {
  return {
    configured: isStoreConfigured(),
    originFrom: isDbConfigured() ? "DATABASE_URL" : null,
    lastWriteAt: stats.lastWriteAt
      ? new Date(stats.lastWriteAt).toISOString()
      : null,
    lastWriteRows: stats.lastWriteRows,
    lastError: stats.lastError,
    lastErrorAt: stats.lastErrorAt
      ? new Date(stats.lastErrorAt).toISOString()
      : null,
    writesOk: stats.writesOk,
    writesFailed: stats.writesFailed,
    rowsWritten: stats.rowsWritten,
    hydrateHits: stats.hydrateHits,
    hydrateMisses: stats.hydrateMisses,
  };
}

function noteError(err: unknown): void {
  stats.lastError = err instanceof Error ? err.message : String(err);
  stats.lastErrorAt = Date.now();
}

/** Called by the aggregator so the health route can report the hit rate. */
export function noteHydrate(hits: number, misses: number): void {
  stats.hydrateHits += hits;
  stats.hydrateMisses += misses;
}

/**
 * How many rows the table holds, straight from PostgREST.
 *
 * The one number a healthy-looking log cannot fake, and therefore the only
 * honest answer to "is the archive working". Used by the health route; never
 * called on the request path.
 */
export async function countArticles(): Promise<number | null> {
  if (!isStoreConfigured()) return null;
  try {
    const rows = await query<{ count: string }>(
      "SELECT count(*)::text AS count FROM articles",
      [],
      READ_TIMEOUT_MS,
    );
    const total = rows[0]?.count;
    return total === undefined ? null : Number(total);
  } catch (err) {
    noteError(err);
    return null;
  }
}

// ── Writing ─────────────────────────────────────────────────────────────────

async function writeBatch(
  rows: CoreRow[] | EnrichedRow[],
  timeoutMs: number,
): Promise<void> {
  if (rows.length === 0) return;

  // The column list comes from the first row, which is why partitionForWrite
  // exists: core rows and enriched rows are written in separate batches so this
  // list is uniform. Mixing them would make one batch's column set decide what
  // every row in it writes.
  const columns = Object.keys(rows[0] as unknown as Record<string, unknown>);

  // One statement for the whole batch. 500 rows as 500 statements is 500 round
  // trips; as one it measured 329 ms.
  const values: unknown[] = [];
  const tuples = rows.map((row, rowIndex) => {
    const record = row as unknown as Record<string, unknown>;
    const placeholders = columns.map((column, columnIndex) => {
      values.push(record[column] ?? null);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });
    return `(${placeholders.join(",")})`;
  });

  // The most important line in this module. The update list is built from the
  // columns this batch actually carries, so a pass that wrote core columns only
  // cannot null out a translation an earlier pass paid a model for. `EXCLUDED`
  // is the row that would have been inserted.
  //
  // first_seen_at is never in `columns` and so is never updated: it means the
  // first time this story was seen, and an upsert must not move it.
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  await query(
    `INSERT INTO articles (${columns.join(",")}) VALUES ${tuples.join(",")}
     ON CONFLICT (id) DO UPDATE SET ${updates}`,
    values,
    timeoutMs,
  );
}

/**
 * Record this pass's stories.
 *
 * Returns the number of rows written, or 0 for every reason it did not write —
 * unconfigured, out of time, or failed. Callers are not expected to check it; it
 * exists so tests and the health route can.
 *
 * The two payload shapes come from `partitionForWrite`, and the reason there are
 * two is the most important invariant in this module — it is documented there,
 * with the consequence of getting it wrong.
 *
 * `deadline` is the absolute timestamp the whole regeneration must be done by.
 * Passing one from a pass that has already overrun means this does nothing,
 * which is the correct outcome: the reader waiting on that pass should not also
 * wait on the archive.
 */
export async function recordArticles(
  items: NewsItem[],
  deadline: number,
): Promise<number> {
  if (!isStoreConfigured() || items.length === 0) return 0;

  const budget = Math.min(WRITE_TIMEOUT_MS, deadline - Date.now());
  if (budget <= 0) {
    console.warn(
      `[article-store] skipped ${items.length} rows — no time left in the pass`,
    );
    return 0;
  }

  const { enriched, core } = partitionForWrite(items, new Date().toISOString());

  let written = 0;
  let failed = false;

  for (const group of [enriched, core] as (CoreRow[] | EnrichedRow[])[]) {
    for (let i = 0; i < group.length && !failed; i += WRITE_BATCH) {
      const remaining = Math.min(WRITE_TIMEOUT_MS, deadline - Date.now());
      if (remaining <= 0) {
        failed = true;
        break;
      }

      const batch = group.slice(i, i + WRITE_BATCH);
      try {
        await writeBatch(batch, remaining);
        written += batch.length;
      } catch (err) {
        // One warning for the pass, not one per batch: a database that is down
        // is down for all of them, and a log line per batch turns a single
        // outage into a wall of identical noise.
        console.warn(
          `[article-store] write failed after ${written} of ${items.length} rows:`,
          err instanceof Error ? err.message : err,
        );
        noteError(err);
        failed = true;
      }
    }
  }

  stats.lastWriteAt = Date.now();
  stats.lastWriteRows = written;
  stats.rowsWritten += written;
  if (failed) stats.writesFailed++;
  else stats.writesOk++;

  return written;
}

// ── Reading ─────────────────────────────────────────────────────────────────

/**
 * What a stored row can tell the enrichment stage.
 *
 * `enrichmentKey` is the whole contract. It is the same key
 * lib/enrichment-cache.ts uses in memory — the story id plus a hash of the exact
 * text sent to the model — so a caller compares it against a freshly computed
 * one and only trusts the rest when they match. That is what makes a publisher's
 * silent edit produce a fresh translation instead of a stale one served forever.
 */
export interface StoredEnrichment {
  enrichmentKey: string | null;
  summary: string;
  titleTranslated: string | null;
  summaryTranslated: string | null;
  quality: StoryQuality | null;
}

/**
 * What the archive already knows about these stories.
 *
 * The L2 behind lib/enrichment-cache.ts's in-process L1, and the reason the site
 * can be bilingual at all. The measured arithmetic: the free tier allows 1,060
 * model requests a day, batching makes that ~10,600 story-slots against ~1,500
 * new stories — a surplus that was being spent entirely on re-translating
 * stories every cold start, 288 times a day, because the only memory was a Map
 * inside a process that keeps ending.
 *
 * Bounded and failure-tolerant like everything else here: a chunk that times out
 * is simply missing from the result, which costs its stories a model request
 * rather than costing the pass anything.
 */
export async function fetchEnrichments(
  ids: string[],
  deadline: number,
): Promise<Map<string, StoredEnrichment>> {
  const found = new Map<string, StoredEnrichment>();
  if (!isStoreConfigured()) return found;

  const wanted = [...new Set(ids)].filter((id) => ID_PATTERN.test(id));
  if (wanted.length === 0) return found;

  for (let i = 0; i < wanted.length; i += READ_CHUNK) {
    const remaining = Math.min(READ_TIMEOUT_MS, deadline - Date.now());
    if (remaining <= 0) break;

    const chunk = wanted.slice(i, i + READ_CHUNK);
    try {
      // `= ANY($1)` takes the whole chunk as one array parameter. Interpolating
      // the ids into the SQL would work — they are hex, and ID_PATTERN has
      // already rejected anything else — but a parameter needs no such argument
      // to be true, and the next person to widen that pattern will not read it.
      const rows = await query<{
        id: string;
        summary: string | null;
        title_translated: string | null;
        summary_translated: string | null;
        enrichment_key: string | null;
        quality: StoryQuality | null;
      }>(
        `SELECT id, summary, title_translated, summary_translated,
                enrichment_key, quality
           FROM articles WHERE id = ANY($1)`,
        [chunk],
        remaining,
      );
      for (const row of rows) {
        found.set(row.id, {
          enrichmentKey: row.enrichment_key,
          summary: row.summary ?? "",
          titleTranslated: row.title_translated,
          summaryTranslated: row.summary_translated,
          quality: row.quality,
        });
      }
    } catch (err) {
      console.warn(
        "[article-store] enrichment read failed:",
        err instanceof Error ? err.message : err,
      );
      noteError(err);
      break;
    }
  }

  return found;
}

/**
 * One story by id, from the archive rather than the feed.
 *
 * This is the function Phase 2 existed to make possible. Until it was written a
 * permalink was only valid while its story was still inside the aggregation
 * window: share a link, wait a month, get a 404 for a page that was real.
 */
export async function fetchStoredStory(id: string): Promise<NewsItem | null> {
  if (!isStoreConfigured() || !ID_PATTERN.test(id)) return null;
  try {
    const rows = await query<StoredArticleRow & Record<string, unknown>>(
      `SELECT ${STORY_SELECT.split(",").join(", ")}
         FROM articles WHERE id = $1 LIMIT 1`,
      [id],
      READ_TIMEOUT_MS,
    );
    const row = rows[0];
    return row ? fromRow(row) : null;
  } catch (err) {
    console.warn(
      `[article-store] story read failed for ${id}:`,
      err instanceof Error ? err.message : err,
    );
    noteError(err);
    return null;
  }
}
