// lib/feed/serializers.ts
// Serialize DB FeedArticle into the public API contract.
// Keeps the DB layer decoupled from the API response shape.

import type { FeedArticle } from "@/lib/schema";

// ── Public article shape ──────────────────────────────────────────────────────

/** Compact API-safe article shape. Fields are stable across versions. */
export interface ApiArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  /** 'national' | 'international' */
  scope: string;
  url: string;
  title: string;
  titleNp: string | null;
  summary: string | null;
  summaryNp: string | null;
  imageUrl: string | null;
  publishedAt: string;
  publishedTimestamp: number;
  language: string;
  category: string | null;
  score: number;
  clusterId: string | null;
  alternateSourceIds: string[];
}

export function serializeArticle(a: FeedArticle): ApiArticle {
  return {
    id: a.id,
    sourceId: a.sourceId,
    sourceName: a.sourceName,
    scope: a.sourceScope,
    url: a.canonicalUrl,
    title: a.title,
    titleNp: a.titleNp ?? null,
    summary: a.summary ?? null,
    summaryNp: a.summaryNp ?? null,
    imageUrl: a.imageUrl ?? null,
    publishedAt: a.publishedAt,
    publishedTimestamp: a.publishedTimestamp,
    language: a.language,
    category: a.category ?? null,
    score: a.score,
    clusterId: a.clusterId ?? null,
    alternateSourceIds: a.alternateSourceIds,
  };
}

export function serializeArticles(articles: FeedArticle[]): ApiArticle[] {
  return articles.map(serializeArticle);
}
