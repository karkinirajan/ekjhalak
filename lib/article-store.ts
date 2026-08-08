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

/**
 * The REST origin, under either name.
 *
 * `SUPABASE_URL` is the name this module has always read and the name the docs
 * use. `NEXT_PUBLIC_SUPABASE_URL` is accepted because it is the name Supabase's
 * own dashboard and every quickstart put in front of the operator, and this
 * project has now lost three separate features to a variable being spelled the
 * way some other tool spells it: `RESENT_API_KEY` swallowed every newsletter
 * signup for weeks, `DATABASE_URL` was set where the REST origin belonged, and
 * then the origin arrived under the `NEXT_PUBLIC_` prefix. Guessing which
 * spelling wins is not a thing an operator should have to do three times.
 *
 * Accepting both is safe *for this value specifically*: the REST origin is not a
 * secret. It is in the URL bar of every Supabase app and is designed to be
 * public. The same latitude is emphatically not extended to the key below.
 */
const ORIGIN_ENV =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * The service-role key must never be readable from a browser.
 *
 * It bypasses row-level security completely — it is the only credential that can
 * write this table, which is the point, and also why a `NEXT_PUBLIC_` copy of it
 * would be a full database compromise inlined into every JavaScript bundle the
 * site serves. Next.js does that inlining silently and at build time, so the
 * mistake produces no error and no visible symptom.
 *
 * Given the run of near-misses above, this checks rather than assumes. It cannot
 * un-leak a key, so it does the two things it can: say so unmissably, and refuse
 * to treat the archive as configured, so the mistake stops a feature instead of
 * quietly shipping a credential.
 */
const LEAKED_KEY_NAMES = Object.keys(process.env).filter(
  (name) =>
    name.startsWith("NEXT_PUBLIC_") &&
    /SERVICE_ROLE|SERVICE_KEY|SECRET/i.test(name),
);

/**
 * The REST origin, or null with a reason logged.
 *
 * It has to be the project's HTTPS origin — `https://<ref>.supabase.co` —
 * because every request here is `${origin}/rest/v1/articles`. Supabase's
 * dashboard puts a Postgres connection string next to it under a similar name,
 * and that is what was actually set in production on the first attempt: `fetch`
 * then threw `TypeError: Request cannot be constructed from a URL that includes
 * credentials` on every batch, the catch swallowed it as designed, and the feed
 * carried on looking healthy while nothing was ever written.
 *
 * Validated once at module load rather than discovered per batch, for two
 * reasons. It makes the mistake loud — one clear line saying what to use instead
 * — and it makes `isStoreConfigured()` answer false, so the aggregator stops
 * reserving three seconds out of the model stage for a write that cannot
 * succeed. Silently costing every reader three seconds of enrichment is a worse
 * failure than not writing.
 */
const REST_ORIGIN: string | null = (() => {
  if (LEAKED_KEY_NAMES.length > 0) {
    console.error(
      `[article-store] REFUSING TO START: ${LEAKED_KEY_NAMES.join(", ")} is ` +
        "exposed to the browser. NEXT_PUBLIC_ variables are inlined into the " +
        "client bundle at build time, so a service-role key under that prefix " +
        "is published to every visitor and must be rotated, not renamed. The " +
        "archive is disabled until it is gone.",
    );
    return null;
  }

  if (!ORIGIN_ENV) return null;

  let parsed: URL;
  try {
    parsed = new URL(ORIGIN_ENV);
  } catch {
    console.error(
      `[article-store] SUPABASE_URL is not a URL (${ORIGIN_ENV.slice(0, 12)}…). ` +
        "Expected the project's REST origin, e.g. https://<ref>.supabase.co",
    );
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    console.error(
      `[article-store] SUPABASE_URL is a ${parsed.protocol.replace(":", "")} ` +
        "connection string, not the REST origin. This module speaks PostgREST " +
        "over HTTPS, not the Postgres wire protocol — set it to " +
        "https://<project-ref>.supabase.co (Dashboard → Project Settings → " +
        "Data API → Project URL). The archive is disabled until then.",
    );
    return null;
  }

  if (parsed.username || parsed.password) {
    console.error(
      "[article-store] SUPABASE_URL carries credentials, which `fetch` rejects " +
        "outright. Use the bare REST origin; the key travels in a header.",
    );
    return null;
  }

  // Trailing slash would produce `…//rest/v1/articles`, which PostgREST 404s.
  return parsed.origin;
})();

export function isStoreConfigured(): boolean {
  return Boolean(REST_ORIGIN && SERVICE_KEY);
}

/**
 * Rows per write request.
 *
 * PostgREST takes the whole array in one statement, so this is about request
 * size rather than round-trips: 500 rows of a story each is comfortably inside
 * any body limit, and a failure loses one batch rather than the pass.
 */
const WRITE_BATCH = 500;

/**
 * Ids per read request.
 *
 * Far smaller than the write batch, and for an unrelated reason: a read puts its
 * ids in the query string as `id=in.(…)`, and ids are 12 hex characters plus a
 * separator. 120 keeps the URL near 1.6 KB, well under the 8 KB at which proxies
 * and gateways start truncating without telling anyone.
 */
const READ_CHUNK = 120;

/** Ceiling on the whole write, however much of the pass is left. */
const WRITE_TIMEOUT_MS = 5_000;

/** Ceiling on one read round-trip. Shorter: a read is an optimisation. */
const READ_TIMEOUT_MS = 3_000;

/** Ids are SHA-256 prefixes. Anything else never reaches a query string. */
const ID_PATTERN = /^[0-9a-f]{6,64}$/i;

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extra,
  };
}

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
  originFrom: "SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_URL" | null;
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
    originFrom: !REST_ORIGIN
      ? null
      : process.env.SUPABASE_URL
        ? "SUPABASE_URL"
        : "NEXT_PUBLIC_SUPABASE_URL",
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
    const response = await fetch(`${REST_ORIGIN}/rest/v1/articles?select=id`, {
      method: "HEAD",
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      headers: headers({ Prefer: "count=exact", Range: "0-0" }),
      cache: "no-store",
    });
    // PostgREST reports the count in Content-Range as `0-0/1234`.
    const total = response.headers.get("content-range")?.split("/")[1];
    return total && total !== "*" ? Number(total) : null;
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
  const response = await fetch(`${REST_ORIGIN}/rest/v1/articles?on_conflict=id`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: headers({
      "Content-Type": "application/json",
      // merge-duplicates makes this an upsert; return=minimal stops PostgREST
      // serialising every row back at us for a result nobody reads.
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify(rows),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
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

async function getJson<T>(path: string, timeoutMs: number): Promise<T | null> {
  const response = await fetch(`${REST_ORIGIN}${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: headers({ Accept: "application/json" }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as T;
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

  const select =
    "id,summary,title_translated,summary_translated,enrichment_key,quality";

  for (let i = 0; i < wanted.length; i += READ_CHUNK) {
    const remaining = Math.min(READ_TIMEOUT_MS, deadline - Date.now());
    if (remaining <= 0) break;

    const chunk = wanted.slice(i, i + READ_CHUNK);
    try {
      const rows = await getJson<
        {
          id: string;
          summary: string | null;
          title_translated: string | null;
          summary_translated: string | null;
          enrichment_key: string | null;
          quality: StoryQuality | null;
        }[]
      >(
        `/rest/v1/articles?select=${select}&id=in.(${chunk.join(",")})`,
        remaining,
      );
      for (const row of rows ?? []) {
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
    const rows = await getJson<StoredArticleRow[]>(
      `/rest/v1/articles?select=${STORY_SELECT}&id=eq.${id}&limit=1`,
      READ_TIMEOUT_MS,
    );
    const row = rows?.[0];
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
