// lib/ingest/normalize.ts
// Re-exports the story normaliser and URL utilities from lib/feed-normalizer.ts.
// Provides the canonical import path within the lib/ingest subsystem.

export {
  normalizeStory,
  normalizeUrl,
  fingerprintUrl,
  formatPublishedAt,
} from "@/lib/feed-normalizer";
