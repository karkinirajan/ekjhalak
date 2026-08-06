// lib/feed-payload.ts
// What crosses the wire to the browser, and what stays on the server.
//
// The feed is rendered by a client component, so every item handed to it is paid
// for twice: once as HTML and again as the RSC flight payload React needs to
// hydrate. Before this module existed the homepage shipped all 477 aggregated
// stories in both forms — a 697KB document with a 587KB payload inside it — in
// order to paint about 30 cards above and just below the fold.
//
// Two cuts, in this order:
//
//   1. Drop the fields nothing reads. `sourceHomepage`, `category` and
//      `alternateSourceIds` qualify. `credibility` and `sourceId` look
//      server-side but are not:
//      `scoreStory`, `diversifyBySource` and `selectTrending` all run inside the
//      client component, so both fields have to travel. This cut is small.
//
//   2. Cap the count. This is the cut that matters. The client filters by range,
//      region, topic and free text over whatever it holds, so the pool has to be
//      big enough that "This Month" is not a lie — but it does not have to be
//      unbounded. 180 items covers every filter combination the UI offers with
//      room to spare, at roughly a third of the bytes.

import type { NewsItem } from "./news-pipeline";

/**
 * How many stories the browser holds.
 *
 * Sized against the UI rather than guessed: 1 hero + 3 side + 6 trending is 10
 * off the top, the grid pages 12 at a time, and the deepest filter the reader
 * can reach is a single topic over "This Month". 180 keeps every one of those
 * populated — the largest single topic in a live feed was 145 — while cutting
 * the initial payload by about two thirds.
 */
export const FEED_PAGE_LIMIT = 1500;

/**
 * Fields nothing on the client reads, stripped before serialization.
 *
 * Both are optional on NewsItem, so the result still satisfies the interface
 * every component types against — no parallel type to keep in sync, and a
 * component that starts reading one of them fails at the type level rather than
 * finding `undefined` at runtime.
 */
export function toClientItem(item: NewsItem): NewsItem {
  // Copy-and-delete rather than a rest destructure: this way a field added to
  // NewsItem later travels to the client by default, and only the two named
  // here are ever withheld.
  const trimmed: NewsItem = { ...item };
  delete trimmed.sourceHomepage;
  delete trimmed.category;
  delete trimmed.alternateSourceIds;
  return trimmed;
}

export function toClientItems(
  items: NewsItem[],
  limit: number = FEED_PAGE_LIMIT,
): NewsItem[] {
  return items.slice(0, limit).map(toClientItem);
}
