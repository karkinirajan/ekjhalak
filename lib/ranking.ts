// lib/ranking.ts
// Editorial ranking — decides what leads the page and what trends.
//
// Deliberately built only from signals the pipeline actually observes:
//   • how many outlets ran the story (coverageCount, from the deduplicator)
//   • the outlet's credibility score (source registry, editorial judgment)
//   • how fresh it is
//   • whether it shipped a usable lead image
//
// There are no view counts or share counts here because we do not measure
// either. A number on a news page implies it was counted.

import type { NewsItem } from "./news-pipeline";

const HOUR_MS = 60 * 60 * 1000;

/** Half-life decay: a story is worth half as much every 12 hours. */
function freshness(item: NewsItem, now: number): number {
  const ageHours = Math.max(0, (now - item.publishedTimestamp) / HOUR_MS);
  return Math.pow(0.5, ageHours / 12);
}

/**
 * Newsworthiness score. Coverage dominates: a story five outlets ran is a
 * bigger story than one a single outlet ran, almost regardless of who ran it.
 */
export function scoreStory(item: NewsItem, now: number): number {
  const coverage = Math.log2(item.coverageCount + 1) * 40;
  const credibility = item.credibility * 3;
  const recency = freshness(item, now) * 45;
  const breaking = item.topic === "breaking" ? 20 : 0;
  return coverage + credibility + recency + breaking;
}

/**
 * Every story in newsworthiness order.
 *
 * This replaces the old hero split, which pulled one story into a dominant slot
 * and three more into a supporting stack. The feed is now a single grid of
 * equally weighted cards, so ranking's only remaining job is deciding the order
 * those cards appear in: the biggest story of the moment is the first card, and
 * it is rendered exactly like the eleven behind it.
 *
 * The old split also biased the lead toward stories that shipped a photograph.
 * Nothing needs that bias now — every card generates topic-coloured cover art
 * when a feed ships no picture, so a photo-less story costs the page nothing.
 */
export function rankStories(items: NewsItem[], now: number): NewsItem[] {
  return [...items].sort((a, b) => scoreStory(b, now) - scoreStory(a, now));
}

/**
 * Stories for the trending rail, ranked by the same score, with the option to
 * exclude anything already shown elsewhere so the rail adds information.
 *
 * Capped at two per outlet. Publishers push in bursts, so an uncapped rail
 * reliably fills with six consecutive stories from whichever newsroom posted
 * most recently — which tells the reader about that newsroom's schedule, not
 * about the news.
 */
const MAX_PER_SOURCE = 2;

export function selectTrending(
  items: NewsItem[],
  exclude: ReadonlySet<string>,
  limit: number,
  now: number,
): NewsItem[] {
  const ranked = [...items]
    .filter((item) => !exclude.has(item.id))
    .sort((a, b) => scoreStory(b, now) - scoreStory(a, now));

  const perSource = new Map<string, number>();
  const picked: NewsItem[] = [];

  for (const item of ranked) {
    if (picked.length >= limit) break;
    const used = perSource.get(item.sourceId) ?? 0;
    if (used >= MAX_PER_SOURCE) continue;
    perSource.set(item.sourceId, used + 1);
    picked.push(item);
  }

  // If the cap left the rail short (few outlets in this window), backfill by
  // rank rather than render a half-empty box.
  if (picked.length < limit) {
    const chosen = new Set(picked.map((item) => item.id));
    for (const item of ranked) {
      if (picked.length >= limit) break;
      if (!chosen.has(item.id)) picked.push(item);
    }
  }

  return picked;
}

/**
 * Breaks up runs of consecutive stories from the same outlet.
 *
 * The feed is sorted newest-first, and newsrooms publish in bursts — so the
 * first page of "Latest" is routinely twelve stories from one publisher, which
 * reads as a single-source feed and looks monotonous when that publisher also
 * ships no photographs. This walks the list and, whenever the next story repeats
 * the previous outlet, swaps in the nearest story from a different one.
 *
 * The lookahead window keeps the reordering local, so the page stays broadly in
 * reverse-chronological order rather than being shuffled.
 */
export function diversifyBySource(
  items: NewsItem[],
  lookahead = 14,
): NewsItem[] {
  const pool = [...items];
  const ordered: NewsItem[] = [];
  let lastSource = "";

  while (pool.length > 0) {
    let index = 0;

    if (pool[0].sourceId === lastSource) {
      const limit = Math.min(pool.length, lookahead);
      for (let i = 1; i < limit; i++) {
        if (pool[i].sourceId !== lastSource) {
          index = i;
          break;
        }
      }
    }

    const [chosen] = pool.splice(index, 1);
    ordered.push(chosen);
    lastSource = chosen.sourceId;
  }

  return ordered;
}

/**
 * Headlines for the breaking ticker: the newest stories, preferring ones the
 * publisher itself flagged as breaking or that several outlets picked up.
 */
export function selectTicker(
  items: NewsItem[],
  limit: number,
  now: number,
): NewsItem[] {
  return [...items]
    .filter((item) => now - item.publishedTimestamp < 12 * HOUR_MS)
    .sort((a, b) => {
      const aUrgent = a.topic === "breaking" || a.coverageCount > 1 ? 1 : 0;
      const bUrgent = b.topic === "breaking" || b.coverageCount > 1 ? 1 : 0;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      return b.publishedTimestamp - a.publishedTimestamp;
    })
    .slice(0, limit);
}
