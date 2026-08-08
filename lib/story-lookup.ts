// lib/story-lookup.ts
// Resolving a story id to a story. Server-only.
//
// This was written as a seam before it was written as a lookup. The phase plan
// specified that story pages resolve against the `articles` table so a permalink
// outlives the feed window, and for as long as that table was unprovisioned this
// module read the same cached feed the homepage did — with the consequence
// stated plainly in its own header: a permalink was only valid while its story
// was still inside the aggregation window. Share a link, wait a month, get a 404
// for a page that was real.
//
// The table now exists, and this is the module that changes. Nothing above it
// does — the pages, sitemaps and metadata call the same two functions they
// always did, which is what the seam was for.
//
// Order matters: the live feed answers first. It is in memory, it is fresher,
// and it holds the coverage counts and related stories the archive does not. The
// archive answers for everything the feed has forgotten.

// Build-time guard: importing this from a client component is a build
// error rather than a shipped bundle. Calls getPublishedFeed, the whole server pipeline.
import "server-only";

import { getPublishedFeed } from "./aggregator";
import { fetchStoredStory } from "./article-store";
import { isPublishable, publishPolicy } from "./publish-gate";
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

function relatedTo(item: NewsItem, pool: NewsItem[]): NewsItem[] {
  const others = pool.filter((candidate) => candidate.id !== item.id);
  const sameTopic = others.filter((candidate) => candidate.topic === item.topic);
  const rest = others.filter((candidate) => candidate.topic !== item.topic);
  return [...sameTopic, ...rest].slice(0, RELATED_COUNT);
}

/**
 * Find one story by its SHA-256 URL fingerprint.
 *
 * Returns null rather than throwing when the id is unknown, so the page can
 * answer with a real 404 instead of a 500. An unknown id is the normal case for
 * an id that was never real, which is most of what asks.
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

  const live = feed.items.find((candidate) => candidate.id === id);
  if (live) return { item: live, related: relatedTo(live, feed.items) };

  // ── The archive ───────────────────────────────────────────────────────────
  //
  // Everything past this point is a story that has aged out of every feed this
  // site reads. It was real, it may be linked from somewhere, and until the
  // table existed it was a 404.
  const stored = await fetchStoredStory(id);
  if (!stored) return null;

  // The same editorial standard as the feed, deliberately.
  //
  // `PUBLISH_POLICY` decides what this site is willing to put in front of a
  // reader, and a permalink is as reader-facing as the homepage. A story the
  // gate would withhold from the feed is not one to serve merely because it is
  // old — that would make the archive a way around the gate rather than a way
  // to reach the gate's own back catalogue.
  if (!isPublishable(stored, publishPolicy())) return null;

  // Related comes from the live feed rather than from the archive. The reader is
  // on a story that may be months old; "here is what else there is to read"
  // wants today's news, not more of that week's, and the feed is already in hand
  // so it costs nothing.
  return { item: stored, related: relatedTo(stored, feed.items) };
}

/**
 * Every story currently reachable at a permalink, newest first.
 *
 * Used by the sitemaps, and deliberately still the live feed only — this is now
 * a *subset* of what `findStory` resolves, where before the two matched exactly.
 *
 * That asymmetry is the correct one. A sitemap must not list URLs the site would
 * 404 on; it is under no obligation to list every URL that works. Listing the
 * whole archive would mean an entry per story ever seen — roughly 1,500 a day,
 * through the 50,000-URL limit inside a month and into sitemap index files,
 * which is a real piece of work and not this one. Meanwhile the thing that
 * actually mattered for search is already fixed: the archived URLs Google
 * crawled while they *were* listed now answer 200 instead of 404 when it comes
 * back to them.
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
