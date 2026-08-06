// lib/article-store.ts
// Persist each regeneration's stories to Supabase. Server-only.
//
// Three properties this module must never violate, in order:
//
//   1. The feed works without it. Unset env vars, an unreachable database, a
//      schema mismatch, a 500 from PostgREST — every one of them is a warning in
//      the logs and nothing else. `/api/news` builds from RSS and does not read
//      here.
//   2. It cannot spend the pass's budget. The regeneration that runs on the
//      request path has already been taken down twice by a stage that started
//      work without asking how much time was left (see audit/recon.md, D3). This
//      one takes a deadline and clamps its own timeout to it.
//   3. It writes, it does not read. Nothing on the request path awaits a row
//      coming back.
//
// No supabase-js. This is one authenticated POST against PostgREST with an
// upsert header; the client library would add a dependency, a bundle, and a
// connection lifecycle to a module that needs none of them. The rest of this
// codebase parses RSS and extracts article bodies by hand for the same reason.

// Build-time guard: importing this from a client component is a build
// error rather than a shipped bundle. Reads SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
import "server-only";

import type { NewsItem } from "./news-pipeline";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Rows per request.
 *
 * PostgREST takes the whole array in one statement, so this is about request
 * size rather than round-trips: 500 rows of a story each is comfortably inside
 * any body limit, and a failure loses one batch rather than the pass.
 */
const BATCH_SIZE = 500;

/** Ceiling on the whole write, however much of the pass is left. */
const WRITE_TIMEOUT_MS = 5_000;

/**
 * The REST origin, or null with a reason logged.
 *
 * `SUPABASE_URL` has to be the project's HTTPS origin —
 * `https://<ref>.supabase.co` — because every write here is
 * `${SUPABASE_URL}/rest/v1/articles`. Supabase's dashboard puts a Postgres
 * connection string next to it under a similar name, and that is what was
 * actually set in production on the first attempt: `fetch` then threw
 * `TypeError: Request cannot be constructed from a URL that includes
 * credentials` on every batch, the catch below swallowed it as designed, and the
 * feed carried on looking healthy while nothing was ever written.
 *
 * Validated once at module load rather than discovered per batch, for two
 * reasons. It makes the mistake loud — one clear line saying what to use instead
 * — and it makes `isStoreConfigured()` answer false, so the aggregator stops
 * reserving three seconds out of the model stage for a write that cannot
 * succeed. Silently costing every reader three seconds of enrichment is a worse
 * failure than not writing.
 */
const REST_ORIGIN: string | null = (() => {
  if (!SUPABASE_URL) return null;

  let parsed: URL;
  try {
    parsed = new URL(SUPABASE_URL);
  } catch {
    console.error(
      `[article-store] SUPABASE_URL is not a URL (${SUPABASE_URL.slice(0, 12)}…). ` +
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

  // Trailing slash would produce `…//rest/v1/articles`, which PostgREST 404s.
  return parsed.origin;
})();

export function isStoreConfigured(): boolean {
  return Boolean(REST_ORIGIN && SERVICE_KEY);
}

/** The table's shape. Snake case here, camel case in the app, converted once. */
interface ArticleRow {
  id: string;
  source_url: string;
  source_id: string;
  source_name: string;
  title: string;
  summary: string;
  original_lang: string;
  title_translated: string | null;
  summary_translated: string | null;
  bucket: string;
  topic: string;
  category: string | null;
  credibility: number | null;
  image_url: string | null;
  published_at: string;
  last_seen_at: string;
  coverage_count: number;
  alternate_source_ids: string[];
}

function toRow(item: NewsItem, seenAt: string): ArticleRow {
  return {
    id: item.id,
    source_url: item.sourceUrl,
    source_id: item.sourceId,
    source_name: item.sourceName,
    title: item.title,
    summary: item.summary,
    original_lang: item.originalLang,
    title_translated: item.titleTranslated ?? null,
    summary_translated: item.summaryTranslated ?? null,
    bucket: item.bucket,
    topic: item.topic,
    category: item.category ?? null,
    credibility: item.credibility,
    image_url: item.imageUrl,
    published_at: new Date(item.publishedTimestamp).toISOString(),
    last_seen_at: seenAt,
    coverage_count: item.coverageCount,
    alternate_source_ids: item.alternateSourceIds ?? [],
  };
}

/**
 * `first_seen_at` is absent from every row on purpose.
 *
 * PostgREST's `merge-duplicates` builds one `on conflict do update` from the
 * union of keys present in the payload, so a column that is never sent is never
 * overwritten. Sending `first_seen_at` would reset it to now() on every pass and
 * quietly destroy the one timestamp in this table that cannot be recovered from
 * anywhere else — the feeds do not remember when we first saw something.
 *
 * On insert the column takes its `default now()`. That is the whole mechanism,
 * and it is why this function must not be "tidied" into sending a full row.
 */
async function writeBatch(rows: ArticleRow[], timeoutMs: number): Promise<void> {
  const response = await fetch(
    `${REST_ORIGIN}/rest/v1/articles?on_conflict=id`,
    {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        apikey: SERVICE_KEY!,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        // merge-duplicates makes this an upsert; return=minimal stops PostgREST
        // serialising every row back at us for a result nobody reads.
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
}

/**
 * Record this pass's stories.
 *
 * Returns the number of rows written, or 0 for every reason it did not write —
 * unconfigured, out of time, or failed. Callers are not expected to check it;
 * it exists so tests can.
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

  const seenAt = new Date().toISOString();
  const rows = items.map((item) => toRow(item, seenAt));
  let written = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const remaining = Math.min(WRITE_TIMEOUT_MS, deadline - Date.now());
    if (remaining <= 0) break;

    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      await writeBatch(batch, remaining);
      written += batch.length;
    } catch (err) {
      // One warning for the pass, not one per batch: a database that is down is
      // down for all of them, and a log line per batch turns a single outage
      // into a wall of identical noise.
      console.warn(
        `[article-store] write failed after ${written} of ${rows.length} rows:`,
        err instanceof Error ? err.message : err,
      );
      break;
    }
  }

  return written;
}
