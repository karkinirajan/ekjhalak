import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    // Both are listed. The news sitemap is not a subset of the main one in the
    // sense a crawler can infer — it carries the `news:` metadata Google News
    // requires and covers only the last 48 hours, so a crawler that only found
    // sitemap.xml would index the stories without ever seeing them as news.
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
