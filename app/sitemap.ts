import type { MetadataRoute } from "next";
import { STANDING_PAGES } from "@/lib/site-nav";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekjhalak.news";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
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
}
