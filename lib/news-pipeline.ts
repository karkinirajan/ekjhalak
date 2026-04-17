// lib/news-pipeline.ts
// Core data types for the feed pipeline.
// NewsItem is the canonical shape used from ingestion through to the UI.

export type RangeKey = "day" | "week" | "month";
export type BucketKey = "national" | "international";
export type OriginalLang = "np" | "en";

export interface NewsItem {
  /** SHA-256 fingerprint of the normalized article URL (first 12 hex chars) */
  id: string;
  /** National (Nepal) or International */
  bucket: BucketKey;
  /** Language of the source article — drives summary/translation direction */
  originalLang: OriginalLang;
  /** Headline, HTML-stripped */
  title: string;
  /** Nepali headline (translated or native) */
  titleNp: string;
  /** Display name of the source publication */
  source: string;
  /** Source registry id, e.g. "kathmandu-post" */
  sourceId: string;
  /** Canonical article URL */
  sourceUrl: string;
  /** Formatted display string, e.g. "Today • 07:15" or "Apr 1 • 09:00" */
  publishedAt: string;
  /** Unix milliseconds — used for range filtering and sort order */
  publishedTimestamp: number;
  /** English news body — source text if EN-origin, else full EN translation. */
  summaryEn: string;
  /** Nepali news body — source text if NP-origin, else full NP translation. */
  summaryNp: string;
  /** Short Groq-generated brief in English (only if originalLang === "en"). */
  briefEn?: string;
  /** Short Groq-generated brief in Nepali (only if originalLang === "np"). */
  briefNp?: string;
  /** Lead image URL from the RSS feed (optional) */
  imageUrl?: string;
  /** Primary category derived from the source registry */
  category?: string;
  /**
   * Source IDs of other outlets that published the same story (dedup pass).
   * Populated by deduplicator when duplicate clusters are found.
   */
  alternateSourceIds?: string[];
  /** Number of duplicate stories collapsed into this canonical item */
  duplicateCount?: number;
}

// ── API response types ───────────────────────────────────────────────────────

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
