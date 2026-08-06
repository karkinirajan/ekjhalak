// lib/site-url.ts
// The one place the site's own address is written down.
//
// It used to be written down in five: robots.ts, sitemap.ts, layout.tsx,
// news-sitemap.xml/route.ts and story/[id]/page.tsx each carried their own
// `process.env.NEXT_PUBLIC_SITE_URL || "…"`. Five copies of a default is five
// chances to disagree about what this site is called, and the URL is not a
// detail here: it is every canonical tag, every OG url, every sitemap <loc> and
// every JSON-LD @id.
//
// The default is the **apex**, not `www`. `www.ekjhalak.news` 301s to
// `ekjhalak.news`, so the previous default meant the site told search engines
// and social crawlers to use a hostname it then redirected away from — a
// redirect ahead of every canonical URL it publishes about itself, and a
// canonical tag that does not match the URL serving the page. `NEXT_PUBLIC_SITE_URL`
// is not set in the Netlify environment, so this default is what production
// actually used.
//
// If the apex ever stops being the served host, change it here and nowhere else.

/** Absolute origin, no trailing slash. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://ekjhalak.news"
).replace(/\/$/, "");

export const SITE_NAME = "EkJhalak News";

/** Absolute URL for a path. `path` is expected to start with a slash. */
export function siteUrl(path = ""): string {
  return `${SITE_URL}${path}`;
}

/** The canonical permalink for a story. */
export function storyUrl(id: string): string {
  return `${SITE_URL}/story/${id}`;
}
