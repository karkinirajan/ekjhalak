// lib/image-hosts.ts
// The image hosts this site is willing to run through Next.js's optimizer.
//
// One list, two consumers: next.config.ts turns it into `images.remotePatterns`,
// and components/story-image.tsx asks it at render time whether a given URL can
// go through `next/image` or has to fall back to a plain `<img>`.
//
// Both consumers are necessary and neither is sufficient. remotePatterns alone
// means an unlisted host renders a broken card, because next/image throws rather
// than degrading. The runtime check alone means nothing is optimized. Together
// they give the property that actually matters: a known publisher's 2.4 MB JPEG
// is resized before a reader downloads it, and an unknown one still appears.
//
// Kept as a plain module rather than derived from source-registry.ts because
// image CDNs and homepages are unrelated hostnames — the BBC serves pages from
// bbc.co.uk and photos from ichef.bbci.co.uk — so there is nothing to derive.

/**
 * Hostnames whose images may be optimized.
 *
 * A leading `**.` matches any subdomain, the same syntax `remotePatterns`
 * accepts, and is matched here by suffix.
 *
 * Anything not on this list still renders. That is the whole design: adding a
 * source must never require a config change to avoid a broken card, only to
 * gain optimization.
 */
export const OPTIMIZABLE_IMAGE_HOSTS = [
  // ── Nepal ───────────────────────────────────────────────────────────────
  "kathmandupost.com",
  "english.onlinekhabar.com",
  "risingnepaldaily.com",
  "ekantipur.com",
  "www.gorkhapatraonline.com",
  "myrepublica.nagariknetwork.com",
  "thehimalayantimes.com",
  "en.setopati.com",
  "www.setopati.com",
  "ratopati.com",
  // Ratopati serves article photos from a separate CDN host, not from
  // ratopati.com. Measured as the second-heaviest image host in a live feed
  // while it was unlisted, so every one of its photos was being served raw.
  "npcdn.ratopati.com",
  "nagariknews.nagariknetwork.com",
  // DC Nepal is a WordPress install serving unresized originals — the 2.4 MB
  // JPEG that was the homepage's LCP element came from here, painted into a
  // 378x236 slot. See audit/baseline/summary.md.
  "www.dcnepal.com",

  // ── International ───────────────────────────────────────────────────────
  "feeds.reuters.com",
  "www.aljazeera.com",
  "ichef.bbci.co.uk",
  "ichef.bbc.co.uk",
  "www.dw.com",
  "www.france24.com",
  // France 24's feed images come from s.france24.com, not www.
  "s.france24.com",
  "i.guim.co.uk",
  "www.thehindu.com",
  "th-i.thgim.com",
  "static.toiimg.com",
  "feeds.feedburner.com",
  "static.ndtv.com",
  "rss.nytimes.com",
  // nytimes.com feeds link photos on static01, never on the rss host.
  "static01.nyt.com",
  "www.politico.eu",
  "cdn.cnn.com",
  "rss.cnn.com",
  "www.cnn.com",
  "www.scmp.com",
  "cdn.i-scmp.com",

  // ── Generic CDNs news sites sit behind ──────────────────────────────────
  "**.cloudfront.net",
  "**.cloudinary.com",
  "**.wp.com",
] as const;

/** The same list in the shape `next.config.ts` wants. */
export const remoteImagePatterns = OPTIMIZABLE_IMAGE_HOSTS.map((hostname) => ({
  protocol: "https" as const,
  hostname,
}));

/**
 * Whether this URL can go through the image optimizer.
 *
 * Returns false for anything that is not an absolute https URL, which covers
 * the locally-generated fallback art (a relative path) as well as malformed
 * feed values — both of which belong on a plain `<img>` anyway.
 */
export function isOptimizableImage(src: string): boolean {
  let host: string;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    host = url.hostname;
  } catch {
    return false;
  }

  return OPTIMIZABLE_IMAGE_HOSTS.some((pattern) =>
    pattern.startsWith("**.")
      ? host.endsWith(pattern.slice(2))
      : host === pattern,
  );
}
