// lib/news-pipeline.ts
// Canonical shape for a news item — used from RSS ingestion through to UI.
//
// Every story carries two versions of itself: the one its newsroom published,
// and the same story in the other language. `title`/`summary` are always the
// original; `titleTranslated`/`summaryTranslated` are always the counterpart.
// Which pair the reader sees is decided at render time by `storyText()`.

import type { TopicId } from "./taxonomy";

export type RangeKey = "day" | "week" | "month";
export type BucketKey = "national" | "international";
export type OriginalLang = "np" | "en";

export interface NewsItem {
  /** SHA-256 fingerprint of the normalized article URL (first 12 hex chars) */
  id: string;
  /** National (Nepal) or International */
  bucket: BucketKey;
  /** Language of the source article — also the language of `summary` */
  originalLang: OriginalLang;
  /** Headline in the original language, HTML-stripped */
  title: string;
  /** Canonical article URL — links out to the publisher */
  sourceUrl: string;
  /** Formatted display string, e.g. "Apr 18 • 09:00" */
  publishedAt: string;
  /** Unix milliseconds — used for range filtering and sort order */
  publishedTimestamp: number;
  /** Concise summary in the original language (≤ SUMMARY_MAX_CHARS). */
  summary: string;
  /**
   * The headline rendered into the *other* language — Nepali for an English
   * source, English for a Nepali one. Absent until the enrichment pass has
   * reached this story; the UI falls back to the original when it is missing,
   * which is the honest failure mode for a translation we do not have yet.
   */
  titleTranslated?: string;
  /** The summary in the same other language. Absent under the same conditions. */
  summaryTranslated?: string;
  /** Primary category from the source registry. Server-side only — see lib/feed-payload.ts */
  category?: string;
  /** Editorial topic derived from the article's own words — drives colour coding */
  topic: TopicId;
  /** Lead image from feed metadata. null when the feed supplied none. */
  imageUrl: string | null;
  /** Publisher attribution */
  sourceId: string;
  sourceName: string;
  /** Server-side only — stripped from the client payload. See lib/feed-payload.ts */
  sourceHomepage?: string;
  /** Editorial credibility score 1–10 from the source registry */
  credibility: number;
  /**
   * How many distinct outlets we saw running this story, counted while
   * deduplicating. 1 = a single outlet carried it. This is the real signal
   * behind the trending rail — no synthetic engagement metrics.
   */
  coverageCount: number;
}

export interface SourceStatusMeta {
  id: string;
  name: string;
  ok: boolean;
  itemCount: number;
  fetchedAt: number;
  error?: string;
}

export interface NewsFeedResponse {
  items: NewsItem[];
  meta: {
    total: number;
    fetchedAt: number;
    sourceStatuses: SourceStatusMeta[];
  };
}
