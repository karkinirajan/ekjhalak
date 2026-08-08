// lib/article-rows.ts
// The shape of a story in the archive, in both directions.
//
// Split out of lib/article-store.ts, which is `server-only` and therefore
// untestable in this project's plain-Node test runner. The split is not a
// workaround though — it is the honest seam. What columns to send and what to do
// with the ones that come back is pure data mapping with a rule in it worth
// protecting; talking to PostgREST is transport. Only the first has invariants,
// and only the first can be tested.
//
// Snake case here, camel case in the app, converted once in each direction.

import { formatPublishedAt } from "./feed-normalizer";
import type { NewsItem, OriginalLang, StoryQuality } from "./news-pipeline";
import { TOPICS, type TopicId } from "./taxonomy";

export interface CoreRow {
  id: string;
  source_url: string;
  source_id: string;
  source_name: string;
  title: string;
  summary: string;
  original_lang: string;
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

export interface EnrichedRow extends CoreRow {
  title_translated: string | null;
  summary_translated: string | null;
  enrichment_key: string | null;
  quality: StoryQuality | null;
}

export interface StoredArticleRow extends EnrichedRow {
  first_seen_at: string;
}

/** Every column a story page needs, for the read path. */
export const STORY_SELECT =
  "id,source_url,source_id,source_name,title,summary,original_lang," +
  "title_translated,summary_translated,bucket,topic,category,credibility," +
  "image_url,published_at,first_seen_at,last_seen_at,coverage_count," +
  "alternate_source_ids,quality";

export function toCoreRow(item: NewsItem, seenAt: string): CoreRow {
  return {
    id: item.id,
    source_url: item.sourceUrl,
    source_id: item.sourceId,
    source_name: item.sourceName,
    title: item.title,
    summary: item.summary,
    original_lang: item.originalLang,
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

export function toEnrichedRow(item: NewsItem, seenAt: string): EnrichedRow {
  return {
    ...toCoreRow(item, seenAt),
    title_translated: item.titleTranslated ?? null,
    summary_translated: item.summaryTranslated ?? null,
    enrichment_key: item.enrichmentKey ?? null,
    quality: item.quality ?? null,
  };
}

/**
 * Split a pass's stories into the two payload shapes, and the reason there are
 * two.
 *
 * PostgREST's `merge-duplicates` builds one `on conflict do update` from the
 * union of keys present in the payload, so **a column that is never sent is
 * never overwritten**. Two groups of columns depend on that.
 *
 * `first_seen_at` is omitted from every row, always — see `toCoreRow`, which
 * simply has no such field. Sending it would reset it to now() on every pass and
 * quietly destroy the one timestamp in this table that cannot be recovered from
 * anywhere else: the feeds do not remember when we first saw something. On
 * insert the column takes its `default now()`.
 *
 * The four enrichment columns are omitted from stories *this pass did not
 * enrich*, which is what this function is for. A pass that runs out of model
 * budget — or starts cold with the day's quota already spent, which is most of
 * them — holds no translation for most of the feed. Writing
 * `title_translated: null` for those would erase a translation an earlier pass
 * paid a metered model request for, on every one of the 288 regenerations a day.
 * The archive would spend all day deleting its own most valuable content, and
 * the symptom would be a site that mysteriously refuses to stay bilingual.
 *
 * `enrichmentKey` is the permission slip, and it is stamped in the aggregator
 * only where enrichment actually landed — never where it was merely attempted.
 * Attempted is not answered, and only answered may overwrite.
 *
 * So this is not a tidy-up. It is what makes the archive a cache rather than a
 * rolling deletion, and it must not be "simplified" into one uniform row shape.
 */
export function partitionForWrite(
  items: NewsItem[],
  seenAt: string,
): { enriched: EnrichedRow[]; core: CoreRow[] } {
  const enriched: EnrichedRow[] = [];
  const core: CoreRow[] = [];
  for (const item of items) {
    if (item.enrichmentKey) enriched.push(toEnrichedRow(item, seenAt));
    else core.push(toCoreRow(item, seenAt));
  }
  return { enriched, core };
}

/**
 * A stored row, back in the shape the rest of the app speaks.
 *
 * Every field is defended rather than asserted. This row may have been written
 * by an older deploy against an older taxonomy, and a story page rendering with
 * the wrong topic colour is a far better outcome than one throwing because
 * `topic` holds a string that has since been retired.
 */
export function fromRow(row: StoredArticleRow): NewsItem {
  const published = Date.parse(row.published_at);
  const timestamp = Number.isFinite(published)
    ? published
    : Date.parse(row.first_seen_at) || 0;

  return {
    id: row.id,
    bucket: row.bucket === "international" ? "international" : "national",
    originalLang: (row.original_lang === "en" ? "en" : "np") as OriginalLang,
    title: row.title,
    sourceUrl: row.source_url,
    publishedAt: formatPublishedAt(timestamp),
    publishedTimestamp: timestamp,
    summary: row.summary ?? "",
    titleTranslated: row.title_translated ?? undefined,
    summaryTranslated: row.summary_translated ?? undefined,
    category: row.category ?? undefined,
    topic: (row.topic in TOPICS ? row.topic : "society") as TopicId,
    imageUrl: row.image_url,
    sourceId: row.source_id,
    sourceName: row.source_name,
    credibility: row.credibility ?? 5,
    coverageCount: row.coverage_count ?? 1,
    alternateSourceIds: row.alternate_source_ids?.length
      ? row.alternate_source_ids
      : undefined,
    quality: row.quality ?? undefined,
  };
}
