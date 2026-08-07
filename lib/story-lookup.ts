// lib/story-lookup.ts
// Resolving a story id to a story. Server-only.
//
// This exists as its own module to be a seam, not because finding an item in an
// array needs one. The phase plan specifies that story pages resolve against the
// `articles` table so a permalink outlives the feed window; that table is written
// by lib/article-store.ts but is not provisioned yet, so today this reads the
// same cached feed the homepage does.
//
// The consequence is honest and worth stating plainly: **a permalink is only
// valid while its story is still inside the aggregation window.** Once a story
// ages out of the month range it stops being aggregated, and /story/{id} starts
// returning 404 for a URL that may have been shared. That is the specific
// fragility the `articles` table exists to remove, and it is why swapping this
// module's body — not the pages that call it — is all that Phase 2 going live
// should require.

// Build-time guard: importing this from a client component is a build
// error rather than a shipped bundle. Calls getPublishedFeed, the whole server pipeline.
import "server-only";

import { getPublishedFeed } from "./aggregator";
import type { NewsItem } from "./news-pipeline";

export interface StoryLookup {
  item: NewsItem;
  /**
   * Other stories to offer at the end. Same topic first, then whatever else is
   * recent — a reader who reached the bottom of a 400-character excerpt has
   * either clicked through to the publisher or wants something else to read.
   */
  related: NewsItem[];
}

const RELATED_COUNT = 6;

/**
 * Find one story by its SHA-256 URL fingerprint.
 *
 * Returns null rather than throwing when the id is unknown, so the page can
 * answer with a real 404 instead of a 500. An unknown id is the normal case for
 * an expired permalink, not an error.
 */
export async function findStory(id: string): Promise<StoryLookup | null> {
  let feed;
  try {
    feed = await getPublishedFeed();
  } catch (err) {
    // A failed aggregation is not a missing story. Letting this throw gives a
    // 500, which is the truthful answer: the story may well exist and we cannot
    // currently say. Answering 404 would tell Google to drop a live URL.
    console.error("[story-lookup] getPublishedFeed failed:", err);
    throw err;
  }

  const item = feed.items.find((candidate) => candidate.id === id);
  if (!item) return null;

  const others = feed.items.filter((candidate) => candidate.id !== id);
  const sameTopic = others.filter((candidate) => candidate.topic === item.topic);
  const rest = others.filter((candidate) => candidate.topic !== item.topic);
  const related = [...sameTopic, ...rest].slice(0, RELATED_COUNT);

  return { item, related };
}

/**
 * Every story currently reachable at a permalink, newest first.
 *
 * Used by the sitemaps. Reads the same source as `findStory` on purpose: a
 * sitemap that lists URLs the site would 404 on is worse than a small sitemap.
 */
export async function listStories(): Promise<NewsItem[]> {
  try {
    const feed = await getPublishedFeed();
    return [...feed.items].sort(
      (a, b) => b.publishedTimestamp - a.publishedTimestamp,
    );
  } catch (err) {
    console.error("[story-lookup] listing failed:", err);
    return [];
  }
}
