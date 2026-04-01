// lib/deduplicator.ts
// Two-pass deduplication:
//   Pass 1 — exact: same URL fingerprint → keep highest-priority source
//   Pass 2 — fuzzy: Jaccard title similarity ≥ 0.65 within 2h window → keep highest-priority

import type { NewsItem } from "./news-pipeline"

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const JACCARD_THRESHOLD = 0.65
// Minimum word length to include in comparison (skips articles, prepositions)
const MIN_WORD_LENGTH = 3

// ── Jaccard title similarity ─────────────────────────────────────────────────

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= MIN_WORD_LENGTH)
  )
}

/** Jaccard similarity: |A ∩ B| / |A ∪ B| */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a)
  const setB = tokenize(b)
  if (setA.size === 0 || setB.size === 0) return 0

  let intersectionCount = 0
  for (const word of setA) {
    if (setB.has(word)) intersectionCount++
  }

  const unionSize = setA.size + setB.size - intersectionCount
  return intersectionCount / unionSize
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/**
 * Deduplicate a list of NewsItems.
 *
 * Assumes items are sorted by (source.priority DESC, publishedTimestamp DESC)
 * before calling — the first occurrence of a duplicate cluster is kept.
 *
 * Pass 1: exact URL fingerprint collision → drop the lower-priority duplicate.
 * Pass 2: fuzzy title match within a 2-hour time window → drop the duplicate.
 *
 * Returns a new array with duplicates removed, in the same relative order.
 */
export function deduplicate(items: NewsItem[]): NewsItem[] {
  // Pass 1: exact id (URL fingerprint) dedup
  const seenIds = new Set<string>()
  const afterPass1: NewsItem[] = []
  for (const item of items) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id)
      afterPass1.push(item)
    }
  }

  // Pass 2: fuzzy title dedup
  // For each item, check if any already-accepted item has high title overlap
  // within a 2-hour publication window.
  const accepted: NewsItem[] = []

  for (const candidate of afterPass1) {
    let isDuplicate = false
    for (const existing of accepted) {
      const timeDiff = Math.abs(candidate.publishedTimestamp - existing.publishedTimestamp)
      if (timeDiff > TWO_HOURS_MS) continue // Different publication windows

      const sim = jaccardSimilarity(candidate.title, existing.title)
      if (sim >= JACCARD_THRESHOLD) {
        isDuplicate = true
        break
      }
    }
    if (!isDuplicate) {
      accepted.push(candidate)
    }
  }

  return accepted
}
