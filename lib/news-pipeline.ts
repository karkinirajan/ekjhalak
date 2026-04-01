// lib/news-pipeline.ts
// Core data types for the feed pipeline.
// NewsItem is the canonical shape used from ingestion through to the UI.

export type RangeKey = "day" | "week" | "month"
export type BucketKey = "national" | "international"

export interface NewsItem {
  /** SHA-256 fingerprint of the normalized article URL (first 12 hex chars) */
  id: string
  /** National (Nepal) or International */
  bucket: BucketKey
  /** Headline, HTML-stripped */
  title: string
  /** Display name of the source publication */
  source: string
  /** Source registry id, e.g. "kathmandu-post" */
  sourceId: string
  /** Canonical article URL */
  sourceUrl: string
  /** Formatted display string, e.g. "Today • 07:15" or "Apr 1 • 09:00" */
  publishedAt: string
  /** Unix milliseconds — used for range filtering and sort order */
  publishedTimestamp: number
  /** English summary (from RSS description, HTML-stripped) */
  summaryEn: string
  /**
   * Nepali summary.
   * Empty until a translation pipeline is connected.
   * UI falls back to summaryEn when empty.
   */
  summaryNp: string
  /** Lead image URL from the RSS feed (optional) */
  imageUrl?: string
}

// ── Legacy ──────────────────────────────────────────────────────────────────
// NewsData is kept for type-checking the old emptyData structure.
// The live API no longer uses this shape — items are returned as a flat array.

export interface NewsData {
  day: { national: NewsItem[]; international: NewsItem[] }
  week: { national: NewsItem[]; international: NewsItem[] }
  month: { national: NewsItem[]; international: NewsItem[] }
}

export const emptyData: NewsData = {
  day: { national: [], international: [] },
  week: { national: [], international: [] },
  month: { national: [], international: [] },
}

// ── API response types ───────────────────────────────────────────────────────

export interface SourceStatusMeta {
  id: string
  name: string
  ok: boolean
  itemCount: number
  fetchedAt: number
  error?: string
}

export interface NewsFeedResponse {
  items: NewsItem[]
  meta: {
    total: number
    fetchedAt: number
    sourceStatuses: SourceStatusMeta[]
  }
}
