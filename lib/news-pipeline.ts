// lib/news-pipeline.ts
// Canonical shape for a news item — used from RSS ingestion through to UI.
// The summary is always in the article's original language; no translation.

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
  /** Canonical article URL (used internally for dedup/fingerprinting only) */
  sourceUrl: string;
  /** Formatted display string, e.g. "Apr 18 • 09:00" */
  publishedAt: string;
  /** Unix milliseconds — used for range filtering and sort order */
  publishedTimestamp: number;
  /** Concise summary in the original language (≤ 600 chars). */
  summary: string;
  /** Primary category from the source registry */
  category?: string;
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
