// lib/enrichment-cache.ts
// Remembers what the model has already written, for as long as the process
// lives. Server-only.
//
// This exists because of arithmetic, not performance. Groq's free tier meters
// requests and tokens per model per day, and the feed regenerates every five
// minutes — 288 times a day. Without a memory, every
// regeneration would re-translate stories that were already translated an hour
// ago and the day's allowance would be gone before breakfast.
//
// With one, enrichment becomes incremental: each pass spends its budget on
// stories nobody has seen yet, and the ones already done cost nothing. A feed
// converges on fully-enriched over the course of a morning instead of thrashing.
//
// It is a process-local Map, so a cold start begins from nothing. That is the
// correct trade for a project with no datastore: the failure mode is "some
// stories show their untranslated original for a while", which the UI already
// renders correctly.

import type { EnrichResult } from "./summarizer";

/**
 * Roughly six full feeds' worth. A NewsItem's enrichment is about 2KB of
 * strings, so this caps the map near 10MB — comfortable inside a function's
 * memory and far more history than a 30-day feed window can reach back through.
 */
const MAX_ENTRIES = 5_000;

const store = new Map<string, EnrichResult>();

/**
 * Cache key: the story id plus a fingerprint of the text that produced the
 * result. The id alone would serve a stale translation forever if a publisher
 * edited the body under the same URL, which several of them do within the first
 * hour of a breaking story.
 */
export function enrichmentKey(id: string, source: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${id}:${(hash >>> 0).toString(36)}`;
}

export function readEnrichment(key: string): EnrichResult | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  // Re-insert so the eviction order below is least-recently-used rather than
  // oldest-written: a story still on the front page should not be evicted by a
  // burst of overnight stories nobody is reading.
  store.delete(key);
  store.set(key, hit);
  return hit;
}

export function writeEnrichment(key: string, value: EnrichResult): void {
  store.delete(key);
  store.set(key, value);
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
}

/** Diagnostics for the feed-health route and the enrichment script. */
export function enrichmentCacheSize(): number {
  return store.size;
}
