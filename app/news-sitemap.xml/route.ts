// app/news-sitemap.xml/route.ts
// The Google News sitemap extension.
//
// A separate route rather than part of app/sitemap.ts because Next.js's
// MetadataRoute.Sitemap has no representation for the `news:` namespace — it
// emits <url> entries and nothing else. This writes the XML directly.
//
// Spec (verified against Google's current documentation rather than memory,
// since this format has changed before):
//   namespace  http://www.google.com/schemas/sitemap-news/0.9
//   required   news:publication > news:name, news:language
//              news:publication_date, news:title
//   window     articles created in the last two days only
//   ceiling    1,000 <news:news> entries per sitemap
//
// `news:access`, `news:genres` and `news:keywords` are not emitted; they are no
// longer part of the documented format.

import { listStories } from "@/lib/story-lookup";
import { SITE_NAME, storyUrl } from "@/lib/site-url";

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
const MAX_ENTRIES = 1_000;

/** Revalidate hourly: a news sitemap is worthless if it lags the news. */
export const revalidate = 3600;

/**
 * XML-escape a text node.
 *
 * Headlines are publisher-supplied text containing ampersands, quotes and
 * angle brackets often enough that skipping this produces a sitemap Google
 * rejects as malformed — silently, from the site owner's point of view.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  const cutoff = Date.now() - TWO_DAYS_MS;

  const stories = (await listStories())
    .filter((item) => item.publishedTimestamp >= cutoff)
    .slice(0, MAX_ENTRIES);

  const entries = stories
    .map((item) => {
      // ISO 639 two-letter. The feed's own language, not the reader's UI
      // toggle — this describes the article as filed.
      const language = item.originalLang === "np" ? "ne" : "en";
      return [
        "  <url>",
        `    <loc>${escapeXml(storyUrl(item.id))}</loc>`,
        "    <news:news>",
        "      <news:publication>",
        `        <news:name>${escapeXml(SITE_NAME)}</news:name>`,
        `        <news:language>${language}</news:language>`,
        "      </news:publication>",
        `      <news:publication_date>${new Date(item.publishedTimestamp).toISOString()}</news:publication_date>`,
        `      <news:title>${escapeXml(item.title)}</news:title>`,
        "    </news:news>",
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    entries,
    "</urlset>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
