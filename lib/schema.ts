// lib/schema.ts
// TypeScript types that mirror the PostgreSQL schema exactly.
// Generated from the migration — keep these in sync.

// ── sources ──────────────────────────────────────────────────────────────────

export type SourceScope = "national" | "international";
export type SourceLanguage = "en" | "np" | "multi";
export type SourceType = "rss" | "api" | "scrape";

export interface DbSource {
  id: string;
  name: string;
  slug: string;
  scope: SourceScope;
  language: SourceLanguage;
  country: string;
  homepageUrl: string;
  rssUrl: string | null;
  apiUrl: string | null;
  sourceType: SourceType;
  active: boolean;
  credibilityWeight: number;
  pollIntervalMinutes: number;
  lastFetchedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── articles_raw ─────────────────────────────────────────────────────────────

export type ParseStatus = "pending" | "ok" | "error";

export interface DbArticleRaw {
  id: string;
  sourceId: string;
  sourceItemId: string | null;
  sourceUrl: string;
  sourcePayloadJson: unknown;
  fetchedAt: Date;
  publishedAt: Date | null;
  checksum: string;
  parseStatus: ParseStatus;
  createdAt: Date;
}

// ── articles ─────────────────────────────────────────────────────────────────

export interface DbArticle {
  id: string;
  sourceId: string;
  canonicalUrl: string;
  titleOriginal: string;
  summaryOriginal: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  fetchedAt: Date;
  language: SourceLanguage;
  category: string | null;
  region: string | null;
  fingerprint: string;
  clusterId: string | null;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── article_clusters ─────────────────────────────────────────────────────────

export interface DbArticleCluster {
  id: string;
  canonicalArticleId: string;
  clusterKey: string;
  topScore: number;
  storyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── article_cluster_members ───────────────────────────────────────────────────

export interface DbArticleClusterMember {
  clusterId: string;
  articleId: string;
  sourceId: string;
}

// ── translations ─────────────────────────────────────────────────────────────

export type TranslationStatus = "pending" | "ok" | "error" | "skipped";

export interface DbTranslation {
  id: string;
  articleId: string;
  lang: string;
  translatedTitle: string | null;
  translatedSummary: string | null;
  provider: string | null;
  status: TranslationStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ── rewrites ─────────────────────────────────────────────────────────────────

export type RewriteStyle = "brief" | "readable";

export interface DbRewrite {
  id: string;
  articleId: string;
  lang: string;
  style: RewriteStyle;
  title: string | null;
  summary: string | null;
  provider: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── ingest_runs ───────────────────────────────────────────────────────────────

export interface DbIngestRun {
  id: string;
  intervalMinutes: number;
  startedAt: Date;
  finishedAt: Date | null;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  newItems: number;
  updatedItems: number;
  dedupedItems: number;
  notes: string | null;
  createdAt: Date;
}

// ── ingest_errors ─────────────────────────────────────────────────────────────

export interface DbIngestError {
  id: string;
  sourceId: string | null;
  runId: string | null;
  stage: string;
  errorMessage: string;
  errorMetaJson: unknown;
  createdAt: Date;
}

// ── subscribers ───────────────────────────────────────────────────────────────

export type SubscriberStatus = "active" | "unsubscribed" | "bounced";

export interface DbSubscriber {
  id: string;
  email: string;
  preferredLanguage: SourceLanguage;
  status: SubscriberStatus;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── API-ready article shape (feed serializer output) ─────────────────────────

export interface FeedArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceScope: SourceScope;
  canonicalUrl: string;
  title: string;
  titleNp: string | null;
  summary: string | null;
  summaryNp: string | null;
  imageUrl: string | null;
  publishedAt: string; // ISO string
  publishedTimestamp: number; // Unix ms
  language: SourceLanguage;
  category: string | null;
  region: string | null;
  score: number;
  clusterId: string | null;
  alternateSourceIds: string[];
  alternateCount: number;
}
