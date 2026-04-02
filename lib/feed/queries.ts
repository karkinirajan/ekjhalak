// lib/feed/queries.ts
// DB-backed feed queries returning FeedArticle shapes.
// Falls back to the in-memory aggregator when DB is unavailable.

import sql from "@/lib/db";
import type { FeedArticle } from "@/lib/schema";

/** Range → lookback window in milliseconds */
export const RANGE_CUTOFFS = {
  day: 24 * 60 * 60 * 1_000,
  week: 7 * 24 * 60 * 60 * 1_000,
  month: 30 * 24 * 60 * 60 * 1_000,
} as const;

export type RangeKey = keyof typeof RANGE_CUTOFFS;
export type ScopeKey = "all" | "national" | "international";

export interface FeedQueryOptions {
  range?: RangeKey;
  scope?: ScopeKey;
  sourceId?: string;
  lang?: "en" | "np";
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface FeedQueryResult {
  articles: FeedArticle[];
  total: number;
  fetchedAt: number;
}

/**
 * Fetch a page of articles from the database with optional filtering.
 * Returns FeedArticle shapes ready for API serialization.
 */
export async function queryFeed(
  opts: FeedQueryOptions = {},
): Promise<FeedQueryResult> {
  const {
    range = "day",
    scope = "all",
    sourceId,
    page = 1,
    pageSize = 30,
    search,
  } = opts;

  const sinceMs = Date.now() - RANGE_CUTOFFS[range];
  const sinceDate = new Date(sinceMs);
  const offset = (Math.max(1, page) - 1) * pageSize;

  const rows = await sql<DbArticleRow[]>`
    select
      a.id,
      a.source_id,
      s.name          as source_name,
      s.scope         as source_scope,
      a.canonical_url,
      a.title_original,
      a.summary_original,
      a.image_url,
      a.published_at,
      a.language,
      a.category,
      a.region,
      a.fingerprint,
      a.cluster_id,
      a.score,
      t_np.translated_title   as title_np,
      t_np.translated_summary as summary_np,
      -- Cluster member source IDs (excluding canonical)
      coalesce(
        (
          select array_agg(acm.source_id order by acm.source_id)
          from article_cluster_members acm
          where acm.cluster_id = a.cluster_id
            and acm.article_id <> a.id
        ),
        '{}'::text[]
      ) as alternate_source_ids
    from articles a
    join sources s on s.id = a.source_id
    left join translations t_np
      on t_np.article_id = a.id
      and t_np.lang = 'np'
      and t_np.status = 'ok'
    where a.published_at >= ${sinceDate}
      and s.active = true
      ${scope === "national" ? sql`and s.scope = 'national'` : scope === "international" ? sql`and s.scope = 'international'` : sql``}
      ${sourceId ? sql`and a.source_id = ${sourceId}` : sql``}
      ${search ? sql`and (a.title_original ilike ${"%" + search + "%"} or a.summary_original ilike ${"%" + search + "%"})` : sql``}
    order by a.published_at desc, a.score desc
    limit ${pageSize}
    offset ${offset}
  `;

  const total = await sql<[{ count: string }]>`
    select count(*)::text as count
    from articles a
    join sources s on s.id = a.source_id
    where a.published_at >= ${sinceDate}
      and s.active = true
      ${scope === "national" ? sql`and s.scope = 'national'` : scope === "international" ? sql`and s.scope = 'international'` : sql``}
      ${sourceId ? sql`and a.source_id = ${sourceId}` : sql``}
      ${search ? sql`and (a.title_original ilike ${"%" + search + "%"} or a.summary_original ilike ${"%" + search + "%"})` : sql``}
  `;

  return {
    articles: rows.map(toFeedArticle),
    total: parseInt(total[0].count, 10),
    fetchedAt: Date.now(),
  };
}

/**
 * Get a single article by ID with its translations and cluster members.
 */
export async function getArticleById(id: string): Promise<FeedArticle | null> {
  const rows = await sql<DbArticleRow[]>`
    select
      a.id,
      a.source_id,
      s.name          as source_name,
      s.scope         as source_scope,
      a.canonical_url,
      a.title_original,
      a.summary_original,
      a.image_url,
      a.published_at,
      a.language,
      a.category,
      a.region,
      a.fingerprint,
      a.cluster_id,
      a.score,
      t_np.translated_title   as title_np,
      t_np.translated_summary as summary_np,
      coalesce(
        (
          select array_agg(acm.source_id order by acm.source_id)
          from article_cluster_members acm
          where acm.cluster_id = a.cluster_id
            and acm.article_id <> a.id
        ),
        '{}'::text[]
      ) as alternate_source_ids
    from articles a
    join sources s on s.id = a.source_id
    left join translations t_np
      on t_np.article_id = a.id
      and t_np.lang = 'np'
      and t_np.status = 'ok'
    where a.id = ${id}
    limit 1
  `;

  if (rows.length === 0) return null;
  return toFeedArticle(rows[0]);
}

// ── Internal DB row shape ─────────────────────────────────────────────────────

interface DbArticleRow {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceScope: "national" | "international";
  canonicalUrl: string;
  titleOriginal: string;
  summaryOriginal: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  language: "en" | "np" | "multi";
  category: string | null;
  region: string | null;
  fingerprint: string;
  clusterId: string | null;
  score: number;
  titleNp: string | null;
  summaryNp: string | null;
  alternateSourceIds: string[];
}

function toFeedArticle(row: DbArticleRow): FeedArticle {
  return {
    id: row.id,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    sourceScope: row.sourceScope,
    canonicalUrl: row.canonicalUrl,
    title: row.titleOriginal,
    titleNp: row.titleNp ?? null,
    summary: row.summaryOriginal ?? null,
    summaryNp: row.summaryNp ?? null,
    imageUrl: row.imageUrl ?? null,
    publishedAt: row.publishedAt.toISOString(),
    publishedTimestamp: row.publishedAt.getTime(),
    language: row.language,
    category: row.category ?? null,
    region: row.region ?? null,
    score: row.score,
    clusterId: row.clusterId ?? null,
    alternateSourceIds: row.alternateSourceIds ?? [],
    alternateCount: (row.alternateSourceIds ?? []).length,
  };
}
