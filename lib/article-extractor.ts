// lib/article-extractor.ts
// Recovers body text for stories whose feed shipped none. Server-only.
//
// A card with a headline and nothing under it is the worst thing this site
// renders — it tells a reader a story exists without telling them anything about
// it. The feeds are mostly fine (475 of 479 items carry a usable description in
// a live sample), but the handful that are not cluster in two Nepali newsrooms,
// and those are exactly the stories a Nepali reader came for.
//
// So before a story is dropped for having nothing to say, its own page is asked.
// Measured on the four offenders: every one has an og:description between 2,000
// and 2,300 characters — the whole article, not a teaser.

// Build-time guard: importing this from a client component is a build
// error rather than a shipped bundle. Fetches other people's pages with a spoofed UA.
import "server-only";

import { decodeEntities, htmlToText } from "./html-entities";

/** A real browser UA. Several Nepali CMSes return a stub page to anything else. */
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 12_000;
/** Past this the rest of the document is comments, related links and scripts. */
const MAX_HTML_BYTES = 1_200_000;
/** Shorter than this is a teaser or a nav crumb, not something to summarise. */
const MIN_USABLE_CHARS = 120;
/** The model gets a hard cap anyway; this just bounds what we hold. */
const MAX_EXTRACTED_CHARS = 6_000;

export type ExtractionSource =
  | "jsonld"
  | "og"
  | "meta"
  | "twitter"
  | "paragraphs";

export interface ExtractionResult {
  text: string;
  via: ExtractionSource;
  /**
   * The article page's own lead image, when the feed did not carry one.
   *
   * Half the feed arrived without a photograph — ten of twenty-two sources at
   * exactly zero, including Kathmandu Post, DW, Al Jazeera and Onlinekhabar —
   * not because those newsrooms publish without pictures but because their RSS
   * omits the media fields `lib/rss-adapter.ts` knows how to read. The page
   * always has one, in og:image, and this pass is already fetching the page.
   *
   * Null when the page declares none, which is then genuinely none.
   */
  imageUrl: string | null;
}

// ── Cache ───────────────────────────────────────────────────────────────────
//
// Keyed by URL and holding failures as well as successes. A page that has no
// extractable body today will not have one in five minutes either, and without
// remembering that, every feed regeneration would re-fetch the same dead URLs.

const cache = new Map<string, ExtractionResult | null>();
const MAX_CACHE_ENTRIES = 2_000;

function remember(url: string, value: ExtractionResult | null) {
  cache.delete(url);
  cache.set(url, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

// ── Candidate extraction ────────────────────────────────────────────────────

/**
 * Put the space back after a danda.
 *
 * Nepali CMSes build og:description by concatenating paragraphs with no
 * separator, so the text arrives as "…गठन गरेको छ।अर्थमन्त्री डा…" — sentences
 * welded together at the danda. It is only ever cosmetic for the model, which
 * reads it correctly either way, but verbatim text goes to the reader exactly as
 * it stands, and a wall with no sentence breaks is hard to read in any script.
 *
 * Danda only. Doing the same for a full stop would put a space inside "U.S." and
 * every abbreviation and decimal in the English feeds.
 */
function restoreSentenceSpacing(text: string): string {
  return text.replace(/।(?=\S)/g, "। ");
}

function metaContent(html: string, attr: string, value: string): string {
  // Both attribute orders occur in the wild, and either quote style.
  const patterns = [
    new RegExp(
      `<meta[^>]+${attr}=["']${value}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      // Decode first, then strip — in that order, and both are needed.
      //
      // A meta `content` attribute cannot contain raw markup, so publishers who
      // build og:description from article HTML ship it escaped: the attribute
      // holds `&lt;p&gt;काठमाडौं।…`. Decoding alone turns that into a real `<p>`
      // and prints it to the reader, which is exactly what DC Nepal's cards were
      // doing. htmlToText afterwards removes the tag the decode revealed.
      const text = htmlToText(decodeEntities(match[1]));
      if (text) return text;
    }
  }
  return "";
}

/** schema.org articleBody, which is the full text when a publisher emits it. */
function jsonLdBody(html: string): string {
  let best = "";
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const nodes: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    // @graph is how most CMSes nest the Article node.
    for (const node of [...nodes]) {
      const graph = (node as { "@graph"?: unknown })?.["@graph"];
      if (Array.isArray(graph)) nodes.push(...graph);
    }
    for (const node of nodes) {
      const record = node as { articleBody?: unknown; description?: unknown };
      for (const field of [record?.articleBody, record?.description]) {
        if (typeof field === "string") {
          const text = htmlToText(field);
          if (text.length > best.length) best = text;
        }
      }
    }
  }
  return best;
}

/**
 * Navigation, not prose.
 *
 * Thaha Khabar renders its whole section menu inside <p>, so joining the page's
 * paragraphs there yields "गृहपृष्ठ राजनीति विश्वकप फुटबल प्रदेश समाचार …" — a
 * list of every section on the site, which reads as a summary of nothing. Real
 * sentences end in a terminator and do not run twenty words without one.
 */
function looksLikeNavigation(text: string): boolean {
  if (!/[.।!?]/.test(text)) return true;
  const words = text.split(/\s+/).length;
  const sentences = (text.match(/[.।!?]/g) ?? []).length;
  return words / Math.max(1, sentences) > 40;
}

function paragraphText(html: string): string {
  const paragraphs: string[] = [];
  for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = htmlToText(match[1]);
    if (text.length < 60) continue;
    if (looksLikeNavigation(text)) continue;
    paragraphs.push(text);
    if (paragraphs.join(" ").length > MAX_EXTRACTED_CHARS) break;
  }
  return paragraphs.join(" ").trim();
}

/**
 * Pick the best candidate.
 *
 * Ordered by trustworthiness, not by length. Paragraph scraping routinely
 * returns the longest string on the page and the least useful one — it was
 * beating a perfectly good 2,063-character og:description with 3,658 characters
 * of site menu. Structured metadata is what the publisher declared the article
 * to be about, so it wins whenever it is substantial enough to summarise, and
 * paragraphs are the last resort rather than the default.
 */
/**
 * The page's declared lead image.
 *
 * og:image first because it is what the publisher chose for sharing — the same
 * picture their own card shows — then twitter:image, then the schema.org
 * `image`. Relative and protocol-relative URLs are resolved against the article
 * URL; anything that is still not an absolute https URL afterwards is dropped
 * rather than rendered as a broken frame.
 */
function pageImage(html: string, pageUrl: string): string | null {
  const candidates = [
    metaContent(html, "property", "og:image"),
    metaContent(html, "property", "og:image:url"),
    metaContent(html, "name", "twitter:image"),
    metaContent(html, "name", "twitter:image:src"),
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const resolved = new URL(raw, pageUrl);
      if (resolved.protocol === "https:") return resolved.toString();
    } catch {
      // Not a URL at all — try the next candidate.
    }
  }
  return null;
}

function bestCandidate(html: string): Omit<ExtractionResult, "imageUrl"> | null {
  const ordered: Array<[ExtractionSource, string]> = [
    ["jsonld", jsonLdBody(html)],
    ["og", metaContent(html, "property", "og:description")],
    ["meta", metaContent(html, "name", "description")],
    ["twitter", metaContent(html, "name", "twitter:description")],
  ];

  for (const [via, text] of ordered) {
    if (text.length >= MIN_USABLE_CHARS) {
      return { text: text.slice(0, MAX_EXTRACTED_CHARS), via };
    }
  }

  const paragraphs = paragraphText(html);
  if (paragraphs.length >= MIN_USABLE_CHARS) {
    return { text: paragraphs.slice(0, MAX_EXTRACTED_CHARS), via: "paragraphs" };
  }

  // Nothing structured cleared the bar — take the longest short candidate
  // rather than nothing, provided it says more than a headline would.
  const fallback = ordered
    .map(([, text]) => text)
    .sort((a, b) => b.length - a.length)[0];
  return fallback && fallback.length >= 60
    ? { text: fallback, via: "og" }
    : null;
}

// ── Fetch ───────────────────────────────────────────────────────────────────

/**
 * How long this one fetch may take, given the pass it belongs to.
 *
 * Without a deadline it is the flat per-request timeout. With one, it is
 * whichever is shorter — because a worker that starts a fetch a millisecond
 * before the budget expires would otherwise run a further twelve seconds past
 * it, and four such workers turn a six-second extraction slice into an
 * eighteen-second one. The deadline check in extractMany decides whether to
 * *start* a fetch; this decides how long the one it started may run.
 */
function fetchTimeout(deadline?: number): number {
  if (deadline === undefined) return FETCH_TIMEOUT_MS;
  return Math.max(1, Math.min(FETCH_TIMEOUT_MS, deadline - Date.now()));
}

async function fetchArticleHtml(
  url: string,
  deadline?: number,
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ne,en;q=0.8",
      },
      redirect: "follow",
      // Non-negotiable. Without it `res.text()` below is unbounded, which is the
      // bug class that took production down twice — see audit/recon.md, D3.
      signal: AbortSignal.timeout(fetchTimeout(deadline)),
      // Declared because it is correct, not because it currently does anything.
      //
      // This stage runs inside `getCachedFeed`, which is `unstable_cache`, and
      // Next.js does not populate the Data Cache from fetches nested inside one —
      // the outer entry is what gets cached, not the calls that produced it.
      // Measured: `.next/cache/fetch-cache` holds a single entry after several
      // passes fetching hundreds of article pages, with and without the abort
      // signal above. The signal was the first suspect and was ruled out.
      //
      // So the in-process Map is the only cache this stage has, and a cold
      // serverless invocation starts empty. Extraction coverage is therefore
      // bounded by what one pass can fetch from the network inside its slice of
      // a 15-second budget, which is why a share of the feed still carries the
      // publisher's two-line teaser. Moving that off the request path is Phase 2's
      // job and is blocked on the archive being provisioned.
      next: { revalidate: 21_600 },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) return null;

  const declared = Number.parseInt(res.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) return null;

  const html = await res.text().catch(() => null);
  if (!html) return null;
  return html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html;
}

/** Body text for one article, or null. Never throws. */
export async function extractArticleText(
  url: string,
  deadline?: number,
): Promise<ExtractionResult | null> {
  if (cache.has(url)) return cache.get(url) ?? null;

  const html = await fetchArticleHtml(url, deadline);
  const found = html ? bestCandidate(html) : null;
  // The image is worth keeping even when the body is not: a story whose page
  // yields no summarisable text still has a photograph, and the card still has
  // a frame to fill.
  const imageUrl = html ? pageImage(html, url) : null;
  const result =
    found || imageUrl
      ? {
          text: found ? restoreSentenceSpacing(found.text) : "",
          via: found?.via ?? ("og" as ExtractionSource),
          imageUrl,
        }
      : null;
  remember(url, result);
  return result;
}

/**
 * Extract for many articles, best stories first, inside a wall-clock budget.
 *
 * Concurrency is deliberately low. These are other people's newsrooms, several
 * of them small Nepali outlets on modest hosting, and this runs every time the
 * feed regenerates — a wide fan-out would be indistinguishable from a scrape.
 * The cache means each URL is fetched once regardless.
 */
export async function extractMany(
  urls: string[],
  deadline: number,
  // 4, and it was 8 for exactly one deploy.
  //
  // Raising it to recover more photographs put the cold pass at 30.9s and
  // returned 502 — over Netlify's limit, the same outage this project already
  // fixed once. The reason is the bug class from audit/recon.md D3 wearing a new
  // coat: `extractMany` checks the deadline before *starting* an item, and the
  // network call it starts is clamped to the deadline, but `bestCandidate` then
  // runs unbounded regex work over up to 1.2 MB of HTML. That is synchronous, it
  // blocks the event loop, and no deadline check covers it — so doubling the
  // workers doubled the CPU the stage could pile up past its slice.
  //
  // Coverage is worth having. It is not worth a 502, and buying it needs the
  // parse bounded, not the fan-out widened.
  concurrency = 4,
): Promise<Map<string, ExtractionResult>> {
  const out = new Map<string, ExtractionResult>();
  const pending = urls.filter((url) => {
    const hit = cache.get(url);
    if (hit) out.set(url, hit);
    return !cache.has(url);
  });
  if (pending.length === 0) return out;

  let cursor = 0;
  async function worker() {
    while (cursor < pending.length && Date.now() < deadline) {
      const url = pending[cursor++];
      const result = await extractArticleText(url, deadline);
      if (result) out.set(url, result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, worker),
  );
  return out;
}

/** Diagnostics for the aggregator's source-health reporting. */
export function extractionCacheSize(): number {
  return cache.size;
}
