import { getCachedFeed } from "@/lib/aggregator";
import { NewsFeed } from "@/components/news-feed";
import type { NewsFeedResponse } from "@/lib/news-pipeline";

// ISR: serve static HTML, regenerate in the background every 5 minutes.
// First visitor gets instant HTML; subsequent visitors get the cached version
// while Next.js revalidates behind the scenes.
export const revalidate = 300;

export default async function Page() {
  let feed;
  try {
    feed = await getCachedFeed();
  } catch (err) {
    console.error("[page] getCachedFeed failed:", err);
    feed = { items: [], sourceStatuses: [], fetchedAt: Date.now() };
  }

  const initialData: NewsFeedResponse = {
    items: feed.items,
    meta: {
      total: feed.items.length,
      fetchedAt: feed.fetchedAt,
      sourceStatuses: feed.sourceStatuses,
    },
  };

  return <NewsFeed initialData={initialData} />;
}
