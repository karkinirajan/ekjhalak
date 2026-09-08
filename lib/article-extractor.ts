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
//
// This file is fetch, cache and scheduling. Turning the fetched HTML into text is
// lib/article-parse.ts, which is pure and therefore testable — and which is where
// the clock lives, because parsing was the one stage in this pipeline that had a
// budget nobody enforced.

// Build-time guard: importing this from a client component is a build
// error rather than a shipped bundle. Fetches other people's pages with a spoofed UA.
import "server-only";

import { parseArticle } from "./article-parse";

// Re-exported so callers that only ever wanted the shape do not have to know
// about the split. lib/aggregator.ts imports `ExtractionResult` from here.
export type {
  ExtractionResult,
  ExtractionSource,
} from "./article-parse";

import type { ExtractionResult } from "./article-parse";

/** A real browser UA. Several Nepali CMSes return a stub page to anything else. */
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 12_000;
/** Past this the rest of the document is comments, related links and scripts. */
const MAX_HTML_BYTES = 1_200_000;

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
      // bounded by what one pass can fetch inside its slice of a 15-second
      // budget — which is what the scheduled drain in netlify/functions exists
      // to lift, now that there is somewhere durable to write.
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
  const result = html ? parseArticle(html, url, deadline) : null;
  remember(url, result);
  return result;
}

/**
 * Extract for many articles, best stories first, inside a wall-clock budget.
 *
 * Concurrency is deliberately modest. These are other people's newsrooms,
 * several of them small Nepali outlets on modest hosting, and this runs every
 * time the feed regenerates — a wide fan-out would be indistinguishable from a
 * scrape. The cache means each URL is fetched once regardless.
 */
export async function extractMany(
  urls: string[],
  deadline: number,
  // 6, having been 4, and 8 for exactly one deploy.
  //
  // The 8 put the cold pass at 30.9 s and returned 502 — over Netlify's limit,
  // the same outage this project already fixed once. The diagnosis at the time
  // named the right culprit: `extractMany` checked the deadline before *starting*
  // an item and clamped the fetch to it, while the parse that followed ran
  // unbounded regex work over up to 1.2 MB of HTML with no clock on it at all.
  //
  // That is now fixed rather than worked around — lib/article-parse.ts builds its
  // metadata table in one pass instead of sixteen and checks the deadline before
  // each expensive stage. Measured on a 1.2 MB page, same output both ways:
  // 3.6 ms → 1.1 ms per article with no usable metadata, 1.6 ms → 0.4 ms with it,
  // which is 1.4 s → 0.5 s of blocked event loop across a 400-story pass. So the
  // fan-out can widen again. It widens to 6 and not back to 8, because the
  // measurement that justified the original retreat was of a cold pass on
  // Netlify, not of this benchmark, and the polite ceiling on somebody else's
  // newsroom is a separate argument from the safe one. Re-measure the cold pass
  // before moving it again.
  concurrency = 6,
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

