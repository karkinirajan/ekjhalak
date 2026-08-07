import { getPublishedFeed } from "@/lib/aggregator";
import { NewsFeed } from "@/components/news-feed";
import {
  FEED_PAGE_LIMIT,
  FEED_SSR_LIMIT,
  toClientItems,
} from "@/lib/feed-payload";
import type { NewsFeedResponse } from "@/lib/news-pipeline";

// ISR: serve static HTML, regenerate in the background every 5 minutes.
// First visitor gets instant HTML; subsequent visitors get the cached version
// while Next.js revalidates behind the scenes.
export const revalidate = 300;

export default async function Page() {
  let feed;
  try {
    feed = await getPublishedFeed();
  } catch (err) {
    console.error("[page] getPublishedFeed failed:", err);
    feed = { items: [], sourceStatuses: [], fetchedAt: 0 };
  }

  // `NewsFeed` is a client component, so whatever it receives is serialized into
  // the RSC flight payload for hydration on top of being rendered as HTML. The
  // unbounded feed made that 477 stories — a 697KB document and a 587KB payload
  // — to paint roughly 30 cards. See lib/feed-payload.ts for what gets cut.
  //
  // The first response carries FEED_SSR_LIMIT, not the whole pool. NewsFeed
  // fills in the rest on mount, so the reader still filters over everything —
  // they just do not wait for it before seeing a page.
  const items = toClientItems(feed.items, FEED_SSR_LIMIT);

  const initialData: NewsFeedResponse = {
    items,
    meta: {
      // The count the reader is told about is the count they can actually
      // filter, not the size of the server-side pool.
      total: items.length,
      fetchedAt: feed.fetchedAt,
      sourceStatuses: feed.sourceStatuses,
    },
  };

  return <NewsFeed initialData={initialData} limit={FEED_PAGE_LIMIT} />;
}
