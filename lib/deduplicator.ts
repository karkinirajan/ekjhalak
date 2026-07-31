// lib/deduplicator.ts
// Two-pass deduplication for news items:
//   Pass 1 — exact: same URL fingerprint → drop duplicates
//   Pass 2 — fuzzy: Jaccard title similarity ≥ 0.65 within 2h → drop duplicates
// Input must already be sorted by (priority DESC, publishedTimestamp DESC)
// so the first occurrence — the canonical one — survives.

import type { NewsItem } from "./news-pipeline";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const JACCARD_THRESHOLD = 0.65;
const MIN_WORD_LENGTH = 3;

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= MIN_WORD_LENGTH),
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const word of setA) if (setB.has(word)) intersectionCount++;

  const unionSize = setA.size + setB.size - intersectionCount;
  return intersectionCount / unionSize;
}

export function deduplicate(items: NewsItem[]): NewsItem[] {
  const seenIds = new Set<string>();
  const afterPass1: NewsItem[] = [];
  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    afterPass1.push(item);
  }

  const accepted: NewsItem[] = [];
  // Which outlets we have already counted toward each survivor's coverage, so
  // a paper republishing its own story twice doesn't inflate the number.
  const outletsPerStory = new Map<string, Set<string>>();

  for (const candidate of afterPass1) {
    let duplicateOf: NewsItem | null = null;
    for (const existing of accepted) {
      const timeDiff = Math.abs(
        candidate.publishedTimestamp - existing.publishedTimestamp,
      );
      if (timeDiff > TWO_HOURS_MS) continue;
      if (jaccardSimilarity(candidate.title, existing.title) >= JACCARD_THRESHOLD) {
        duplicateOf = existing;
        break;
      }
    }

    if (!duplicateOf) {
      accepted.push(candidate);
      outletsPerStory.set(candidate.id, new Set([candidate.sourceId]));
      continue;
    }

    // The duplicate is discarded, but the fact that another outlet ran the same
    // story is real signal — it is how many newsrooms judged it worth covering.
    const outlets = outletsPerStory.get(duplicateOf.id);
    if (outlets && !outlets.has(candidate.sourceId)) {
      outlets.add(candidate.sourceId);
      duplicateOf.coverageCount = outlets.size;
    }

    // A higher-priority outlet won the dedup tie but may have shipped no photo.
    // Borrow one from the duplicate rather than render blank cover art.
    if (!duplicateOf.imageUrl && candidate.imageUrl) {
      duplicateOf.imageUrl = candidate.imageUrl;
    }
  }

  return accepted;
}
