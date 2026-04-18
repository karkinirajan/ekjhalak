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
  for (const candidate of afterPass1) {
    let isDuplicate = false;
    for (const existing of accepted) {
      const timeDiff = Math.abs(
        candidate.publishedTimestamp - existing.publishedTimestamp,
      );
      if (timeDiff > TWO_HOURS_MS) continue;
      if (jaccardSimilarity(candidate.title, existing.title) >= JACCARD_THRESHOLD) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) accepted.push(candidate);
  }

  return accepted;
}
