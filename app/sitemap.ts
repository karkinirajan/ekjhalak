import type { MetadataRoute } from "next";
import { STANDING_PAGES } from "@/lib/site-nav";
import { listStories } from "@/lib/story-lookup";
import { SITE_URL, storyUrl } from "@/lib/site-url";

/**
 * How many story URLs the sitemap carries.
 *
 * The protocol's own ceiling is 50,000 URLs or 50 MB per file, which this is
 * nowhere near — the real bound is `listStories`, which can only return what the
 * feed currently holds (roughly 450). This exists so that a future change to the
 * lookup, such as Phase 2's `articles` table going live and returning months of
 * history, cannot silently start emitting an unbounded sitemap.
 */
const MAX_STORY_URLS = 2_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    // The standing pages change on the order of once a year, so they are
    // declared monthly rather than inheriting the front page's cadence — a
    // crawler told the privacy policy changes hourly will keep coming back for
    // a document that has not moved.
    ...STANDING_PAGES.map((page) => ({
      url: `${SITE_URL}${page.href}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  // A sitemap listing URLs the site would 404 on is worse than a short sitemap,
  // so these come from the same lookup that serves the pages themselves. Until
  // the `articles` table is provisioned that means a story leaves this file when
  // it leaves the aggregation window — see lib/story-lookup.ts.
  const stories = await listStories();

  const storyPages: MetadataRoute.Sitemap = stories
    .slice(0, MAX_STORY_URLS)
    .map((item) => ({
      url: storyUrl(item.id),
      lastModified: new Date(item.publishedTimestamp),
      // A published story's text does not change. What changes is its
      // translation arriving on a later enrichment pass, which is not a reason
      // to re-crawl.
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticPages, ...storyPages];
}
