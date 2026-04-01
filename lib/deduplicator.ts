// lib/deduplicator.ts
// Two-pass deduplication:
//   Pass 1 — exact: same URL fingerprint → keep highest-priority source
//   Pass 2 — fuzzy: Jaccard title similarity ≥ 0.65 within 2h window → keep highest-priority

import type { NewsItem } from "./news-pipeline";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const JACCARD_THRESHOLD = 0.65;
// Minimum word length to include in comparison (skips articles, prepositions)
const MIN_WORD_LENGTH = 3;

// ── Jaccard title similarity ─────────────────────────────────────────────────

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= MIN_WORD_LENGTH),
  );
}

/** Jaccard similarity: |A ∩ B| / |A ∪ B| */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionCount++;
  }

  const unionSize = setA.size + setB.size - intersectionCount;
  return intersectionCount / unionSize;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/**
 * Deduplicate a list of NewsItems.
 *
 * Assumes items are sorted by (source.priority DESC, publishedTimestamp DESC)
 * before calling — the first occurrence of a duplicate cluster is kept.
 *
 * Pass 1: exact URL fingerprint collision → drop the lower-priority duplicate,
 *         recording its sourceId in the canonical item's alternateSourceIds.
 * Pass 2: fuzzy title match within a 2-hour time window → drop the duplicate,
 *         recording its sourceId in the canonical item's alternateSourceIds.
 *
 * Returns a new array with duplicates removed, in the same relative order.
 */
export function deduplicate(items: NewsItem[]): NewsItem[] {
  // Pass 1: exact id (URL fingerprint) dedup
  const seenIds = new Map<string, NewsItem>();
  const afterPass1: NewsItem[] = [];
  for (const item of items) {
    const existing = seenIds.get(item.id);
    if (!existing) {
      seenIds.set(item.id, item);
      afterPass1.push(item);
    } else {
      // Track this source as an alternate for the canonical item
      if (!existing.alternateSourceIds) existing.alternateSourceIds = [];
      if (!existing.alternateSourceIds.includes(item.sourceId)) {
        existing.alternateSourceIds.push(item.sourceId);
      }
      existing.duplicateCount = (existing.duplicateCount ?? 0) + 1;
    }
  }

  // Pass 2: fuzzy title dedup within 2-hour window
  const accepted: NewsItem[] = [];

  for (const candidate of afterPass1) {
    let isDuplicate = false;
    for (const existing of accepted) {
      const timeDiff = Math.abs(
        candidate.publishedTimestamp - existing.publishedTimestamp,
      );
      if (timeDiff > TWO_HOURS_MS) continue;

      const sim = jaccardSimilarity(candidate.title, existing.title);
      if (sim >= JACCARD_THRESHOLD) {
        isDuplicate = true;
        // Track this as an alternate source
        if (!existing.alternateSourceIds) existing.alternateSourceIds = [];
        if (!existing.alternateSourceIds.includes(candidate.sourceId)) {
          existing.alternateSourceIds.push(candidate.sourceId);
        }
        // Carry over any alternates the candidate itself had
        if (candidate.alternateSourceIds) {
          for (const altId of candidate.alternateSourceIds) {
            if (!existing.alternateSourceIds.includes(altId)) {
              existing.alternateSourceIds.push(altId);
            }
          }
        }
        existing.duplicateCount =
          (existing.duplicateCount ?? 0) + 1 + (candidate.duplicateCount ?? 0);
        break;
      }
    }
    if (!isDuplicate) {
      accepted.push(candidate);
    }
  }

  return accepted;
}
