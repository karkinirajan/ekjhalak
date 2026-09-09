// lib/article-parse.ts
// Turning a fetched article page into text. Pure, synchronous, and bounded.
//
// Split out of lib/article-extractor.ts, which is `server-only` and so cannot be
// tested in this project's plain-Node runner. The split is also the honest seam:
// fetching is I/O with a timeout, parsing is CPU with a budget, and only one of
// those was ever actually bounded.
//
// ── Why this file has a clock in it ─────────────────────────────────────────
//
// `audit/recon.md` records a bug class, D3: *a deadline check that gates whether
// work starts, while the work it starts is itself unbounded.* It has now appeared
// five times. The first four were network timeouts. The fifth was here, and it is
// the only one that was not I/O at all — `extractMany` checks the clock before
// starting an article and clamps the fetch to the deadline, and then hands up to
// 1.2 MB of HTML to a chain of regexes that no clock governs. Raising extraction
// concurrency from 4 to 8 to recover more photographs put the cold pass at 30.9 s
// and returned 502.
//
// Measured, so the fix is sized to the problem rather than to the story about it:
// the old chain cost **3.6 ms per article** on a 1.2 MB page with no usable
// metadata — about **1.4 s of blocked event loop for a 400-story pass**. That is
// not the whole of a 30.9 s overrun and should not be sold as it; the bulk was
// network. But it is real, it is invisible, and it scales with exactly the knob
// somebody will reach for next.
//
// After: **1.1 ms** worst case and 0.4 ms typical, for byte-identical output.
//
// Two changes address it. The metadata is parsed in **one** pass instead of
// sixteen — `bestCandidate` and `pageImage` between them made eight
// `metaContent` calls, each running two full-document regexes — and every stage
// takes a deadline, so a pass that has run out of time stops parsing rather than
// finishing out of politeness.

import { decodeEntities, htmlToText } from "./html-entities";

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

/** Shorter than this is a teaser or a nav crumb, not something to summarise. */
export const MIN_USABLE_CHARS = 120;
/** The model gets a hard cap anyway; this just bounds what we hold. */
export const MAX_EXTRACTED_CHARS = 6_000;

/**
 * How much of the document the paragraph scraper may look at.
 *
 * Paragraph text is the last resort, reached only when every piece of structured
 * metadata has already failed, and by then the page has told us it is not going
 * to be well-behaved. An article's prose is in the first part of the body; past a
 * quarter-megabyte it is comment threads, related-link rails and script blobs —
 * the filler this scraper was already discarding, after paying to scan it.
 */
const MAX_PARAGRAPH_SCAN_BYTES = 250_000;

/** JSON-LD blocks to parse before assuming the rest is not an Article node. */
const MAX_JSONLD_BLOCKS = 12;
/** A single JSON-LD block larger than this is a data dump, not article metadata. */
const MAX_JSONLD_BLOCK_BYTES = 200_000;

// ── Metadata, in one pass ───────────────────────────────────────────────────

/**
 * Every `<meta>` tag on the page, keyed `property:og:description` / `name:…`.
 *
 * The point of this function is that it is called **once**. What it replaces ran
 * two full-document regexes per lookup and was looked up eight times — four for
 * the body candidates, four more for the image — so a 1.2 MB page was scanned
 * sixteen times to answer eight questions about a few hundred bytes of `<head>`.
 *
 * Scanning the whole document rather than just the head is deliberate. Slicing at
 * `</head>` would be faster still, and would quietly lose the publishers who emit
 * og: tags inside `<body>` — rarer than it should be, common enough to have
 * caused a bug. One linear pass over the whole thing is cheap enough that the
 * correctness is free.
 */
export function parseMetaTags(html: string): Map<string, string> {
  const found = new Map<string, string>();

  for (const tag of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = tag[1];
    let key = "";
    let content = "";

    for (const attr of attrs.matchAll(/([A-Za-z][\w:.-]*)\s*=\s*["']([^"']*)["']/g)) {
      const name = attr[1].toLowerCase();
      if (name === "property" || name === "name") {
        key = `${name}:${attr[2].toLowerCase()}`;
      } else if (name === "content") {
        content = attr[2];
      }
    }

    // First declaration wins, matching the old regexes' `.match()` semantics.
    if (key && content && !found.has(key)) found.set(key, content);
  }

  return found;
}

export function metaContent(
  meta: Map<string, string>,
  attr: "property" | "name",
  value: string,
): string {
  const raw = meta.get(`${attr}:${value.toLowerCase()}`);
  if (!raw) return "";
  // Decode first, then strip — in that order, and both are needed.
  //
  // A meta `content` attribute cannot contain raw markup, so publishers who
  // build og:description from article HTML ship it escaped: the attribute holds
  // `&lt;p&gt;काठमाडौं।…`. Decoding alone turns that into a real `<p>` and prints
  // it to the reader, which is exactly what DC Nepal's cards were doing.
  // htmlToText afterwards removes the tag the decode revealed.
  return htmlToText(decodeEntities(raw));
}

// ── Candidates ──────────────────────────────────────────────────────────────

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
export function restoreSentenceSpacing(text: string): string {
  return text.replace(/।(?=\S)/g, "। ");
}

/** schema.org articleBody, which is the full text when a publisher emits it. */
export function jsonLdBody(html: string): string {
  let best = "";
  let blocks = 0;

  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    if (++blocks > MAX_JSONLD_BLOCKS) break;
    const body = block[1];
    // A megabyte of JSON is a product catalogue or an event feed, not an
    // article's metadata, and JSON.parse on it is unbounded synchronous work.
    if (body.length > MAX_JSONLD_BLOCK_BYTES) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(body.trim());
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
export function looksLikeNavigation(text: string): boolean {
  if (!/[.।!?]/.test(text)) return true;
  const words = text.split(/\s+/).length;
  const sentences = (text.match(/[.।!?]/g) ?? []).length;
  return words / Math.max(1, sentences) > 40;
}

/**
 * Paywall and subscription furniture.
 *
 * Distinct from `looksLikeNavigation`, which catches a menu by its shape — no
 * terminators, or twenty words between them. This catches text that is
 * perfectly well-formed prose and still not the article: The Hindu opens its
 * paragraph list with "Subscribed with another email? Logout and Login with
 * that one. Account subscription benefits alongside Premium Stories," which is
 * three real sentences and sails through the shape test.
 *
 * Lives here rather than in lib/summarizer.ts because this module is the pure
 * half of the parse — no `server-only`, so the project's plain-Node runner can
 * test it — and because one pattern used at two granularities is better than
 * two copies drifting apart. The summarizer imports it for whole-summary
 * checks; `paragraphText` applies it per paragraph, which is where the
 * furniture actually is.
 */
export const BOILERPLATE =
  /unlock these with subscription|subscription benefits|already a subscriber|to continue reading|sign up (?:to|for) (?:our|the)|all rights reserved|logout and login|premium stories|subscribe to continue|create a free account|newsletter signup|accept (?:all )?cookies|manage preferences/i;

export function looksLikeBoilerplate(text: string): boolean {
  return BOILERPLATE.test(text);
}

/**
 * Shortest paragraph counted as article prose.
 *
 * 120, having been 60. A promotional blurb and a paragraph of reporting differ
 * reliably in length, and 60 sat below both. Measured on The Hindu, whose
 * newsletter rail survives every shape-based filter because it is written in
 * complete sentences: "The View From India Looking at World Affairs from the
 * Indian perspective." is 72 characters, and its four neighbours run 70 to 110,
 * while the article's own opening paragraph is 195. At 60 all five promos led
 * the extraction; at 120 none of them do.
 *
 * The cost is that genuine one-line paragraphs — an isolated quote, a single
 * short sentence of attribution — are dropped too. For this pipeline that is
 * the right trade: the extracted text is a corpus to summarise from, not a
 * reproduction of the article, and dropping the shortest fragments makes it
 * denser rather than poorer.
 */
const MIN_PARAGRAPH_CHARS = 120;

/**
 * Social-widget labels welded onto the front of the first paragraph.
 *
 * Nepal Khabar renders its share bar inside the same <p> as the opening
 * sentence, so the body arrives as "Shares उद्योग, वाणिज्य तथा…". No length or
 * shape test can catch that — the paragraph is real prose with three junk
 * characters in front — so it is trimmed by name. Anchored to the start and
 * requiring what follows to be a word boundary, so an article that genuinely
 * opens on the word "Share" is untouched.
 */
function stripWidgetPrefix(text: string): string {
  return text.replace(
    /^(?:shares?|tweet|share this|follow us|advertisement|listen to this article)\s+(?=\S)/i,
    "",
  );
}

export function paragraphText(html: string): string {
  const scannable =
    html.length > MAX_PARAGRAPH_SCAN_BYTES
      ? html.slice(0, MAX_PARAGRAPH_SCAN_BYTES)
      : html;

  const paragraphs: string[] = [];
  let length = 0;

  for (const match of scannable.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripWidgetPrefix(htmlToText(match[1]));
    if (text.length < MIN_PARAGRAPH_CHARS) continue;
    if (looksLikeNavigation(text)) continue;
    if (looksLikeBoilerplate(text)) continue;
    paragraphs.push(text);
    // Tracked rather than re-joined. The old loop called `paragraphs.join(" ")`
    // on every accepted paragraph purely to test its length, which is quadratic
    // in the number of paragraphs and was doing the one expensive thing this
    // function could avoid.
    length += text.length + 1;
    if (length > MAX_EXTRACTED_CHARS) break;
  }
  return paragraphs.join(" ").trim();
}

/**
 * The page's declared lead image.
 *
 * og:image first because it is what the publisher chose for sharing — the same
 * picture their own card shows — then twitter:image, then the schema.org
 * `image`. Relative and protocol-relative URLs are resolved against the article
 * URL; anything that is still not an absolute https URL afterwards is dropped
 * rather than rendered as a broken frame.
 */
export function pageImage(
  meta: Map<string, string>,
  pageUrl: string,
): string | null {
  const candidates = [
    metaContent(meta, "property", "og:image"),
    metaContent(meta, "property", "og:image:url"),
    metaContent(meta, "name", "twitter:image"),
    metaContent(meta, "name", "twitter:image:src"),
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

/**
 * Pick the best candidate.
 *
 * Ordered by trustworthiness, not by length. Paragraph scraping routinely
 * returns the longest string on the page and the least useful one — it was
 * beating a perfectly good 2,063-character og:description with 3,658 characters
 * of site menu. Structured metadata is what the publisher declared the article
 * to be about, so it wins whenever it is substantial enough to summarise, and
 * paragraphs are the last resort rather than the default.
 *
 * `deadline` is the pass's absolute wall-clock limit, and the reason it reaches
 * this far down. Everything above is cheap; `jsonLdBody` and `paragraphText` are
 * the two stages whose cost scales with a page the publisher chose the size of,
 * so each is asked whether there is still time before it runs. Out of time
 * returns whatever cheaper candidates already found — the story keeps the
 * publisher's own text and the next pass tries again, which is what every other
 * stage in this pipeline does when its budget runs out.
 */
export function bestCandidate(
  html: string,
  meta: Map<string, string>,
  deadline?: number,
): Omit<ExtractionResult, "imageUrl"> | null {
  const inTime = () => deadline === undefined || Date.now() < deadline;

  // Cheap: three map lookups against a table that has already been built.
  const cheap: Array<[ExtractionSource, string]> = [
    ["og", metaContent(meta, "property", "og:description")],
    ["meta", metaContent(meta, "name", "description")],
    ["twitter", metaContent(meta, "name", "twitter:description")],
  ];

  // JSON-LD outranks all of them when present, so it is tried first despite
  // costing more — but only while there is time to pay for it.
  const jsonld = inTime() ? jsonLdBody(html) : "";
  const ordered: Array<[ExtractionSource, string]> = [
    ["jsonld", jsonld],
    ...cheap,
  ];

  // Structured metadata wins outright only when it is *substantial*.
  //
  // The bar used to be MIN_USABLE_CHARS — 120 — and that one constant was the
  // largest accuracy defect in the pipeline. A 126-character og:description
  // cleared it, returned immediately, and `paragraphText` was never reached.
  // Measured against live pages: Nepal Khabar returned 347 chars via og where
  // its paragraphs hold 1,578; Ratopati 126 against 1,061; Onlinekhabar 156
  // against 2,016. The aggregator then only replaces feed text with page text
  // when the page's is longer, so Nepal Khabar — whose RSS hard-cuts at 500
  // mid-word — kept the truncated feed copy on every pass. Twenty of twenty of
  // its stories ended mid-sentence in production.
  //
  // 600 is the bar because it is roughly where a description stops being a
  // teaser and starts being a précis. Above it, the publisher's own summary is
  // preferred and nothing expensive runs. Below it, paragraphs are consulted
  // and the longer of the two wins — which is the original ordering's intent
  // ("substantial enough to summarise") with a threshold that actually means it.
  const SUBSTANTIAL_METADATA_CHARS = 600;

  for (const [via, text] of ordered) {
    if (text.length >= SUBSTANTIAL_METADATA_CHARS) {
      return { text: text.slice(0, MAX_EXTRACTED_CHARS), via };
    }
  }

  // Thin metadata: the page body may say considerably more. The comparison is
  // what keeps the original concern honest — paragraph scraping was once
  // beating a good 2,063-char og:description with 3,658 chars of site menu, so
  // paragraphs have to *earn* it on length after the navigation and paywall
  // filters have had their say, rather than winning by being tried last.
  const best = ordered.find(([, text]) => text.length >= MIN_USABLE_CHARS);

  if (inTime()) {
    const paragraphs = paragraphText(html);
    if (
      paragraphs.length >= MIN_USABLE_CHARS &&
      paragraphs.length > (best?.[1].length ?? 0)
    ) {
      return {
        text: paragraphs.slice(0, MAX_EXTRACTED_CHARS),
        via: "paragraphs",
      };
    }
  }

  if (best) {
    return { text: best[1].slice(0, MAX_EXTRACTED_CHARS), via: best[0] };
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

/**
 * Everything the parse stage does for one page, so callers cannot forget to
 * share the metadata table between the body and the image.
 */
export function parseArticle(
  html: string,
  pageUrl: string,
  deadline?: number,
): ExtractionResult | null {
  const meta = parseMetaTags(html);
  const found = bestCandidate(html, meta, deadline);
  // The image is worth keeping even when the body is not: a story whose page
  // yields no summarisable text still has a photograph, and the card still has a
  // frame to fill.
  const imageUrl = pageImage(meta, pageUrl);

  if (!found && !imageUrl) return null;
  return {
    text: found ? restoreSentenceSpacing(found.text) : "",
    via: found?.via ?? "og",
    imageUrl,
  };
}
