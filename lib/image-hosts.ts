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
  // Publisher domains are listed as `**.` wildcards rather than as the one
  // hostname that happened to be observed serving photographs.
  //
  // Every exact-match entry here had needed a follow-up fix: Ratopati serves
  // from npcdn., France 24 from s., the NYT from static01., the BBC from
  // ichef. Measuring a live feed found eight more still unlisted —
  // assets-cdn.kathmandupost.com, c.ndtvimg.com, images.nagariknewscdn.com,
  // static.dw.com and www.onlinekhabar.com among them — together carrying
  // about a third of the feed's images past the optimizer. The Kathmandu Post
  // one was the homepage's LCP element: a 375 KiB JPEG, 180 KiB of which was
  // the cost of not being WebP.
  //
  // A wildcard per publisher domain ends that class of miss. It widens what may
  // be optimized to any subdomain of a newsroom already trusted enough to be a
  // source, which is the same trust boundary — and an unlisted host was never
  // blocked, only unoptimized, so this trades no safety for the coverage.
  //
  // `**.example.com` is matched by `.example.com` suffix, so the leading dot is
  // load-bearing: `notkathmandupost.com` and `kathmandupost.com.attacker.net`
  // both fail it. An apex is listed separately only where the apex itself was
  // measured serving images, which is why most publishers appear once.
  //
  // Keep this under 50 entries. `images.remotePatterns` is capped there by
  // Next.js, and the cap is enforced at server start rather than at build —
  // a 53-entry list compiled cleanly and then refused to boot.

  // ── Nepal ───────────────────────────────────────────────────────────────
  "**.kathmandupost.com",
  "**.onlinekhabar.com",
  "**.risingnepaldaily.com",
  "risingnepaldaily.com",
  "**.ekantipur.com",
  "**.gorkhapatraonline.com",
  "**.nagariknetwork.com",
  // Nagarik's photo CDN is a separate domain, not a subdomain of the above.
  "**.nagariknewscdn.com",
  "**.thehimalayantimes.com",
  "**.setopati.com",
  "**.ratopati.com",
  "**.dcnepal.com",
  "**.bizmandu.com",
  "bizmandu.com",
  "**.nepalkhabar.com",
  "**.thahakhabar.com",
  "**.himalkhabar.com",
  "**.rssnepal.org.np",

  // ── International ───────────────────────────────────────────────────────
  "**.aljazeera.com",
  "**.bbci.co.uk",
  "**.bbc.co.uk",
  "**.dw.com",
  "**.france24.com",
  "**.guim.co.uk",
  "**.thehindu.com",
  "**.thgim.com",
  "**.toiimg.com",
  "**.ndtvimg.com",
  "**.ndtv.com",
  "**.nyt.com",
  "**.politico.eu",
  "**.cnn.com",
  "**.scmp.com",
  "**.i-scmp.com",
  "**.reuters.com",
  "**.apnews.com",
  "**.washingtonpost.com",
  "**.wsj.net",
  "**.bwbx.io",

  // ── Generic CDNs news sites sit behind ──────────────────────────────────
  // Nepal Khabar's photographs are on Prixa, a third-party CDN, rather than on
  // any subdomain of nepalkhabar.com — so the publisher wildcard does not reach
  // them and this is a separate entry.
  "**.prixacdn.net",
  "**.cloudfront.net",
  "**.cloudinary.com",
  "**.wp.com",
  "**.feedburner.com",
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
