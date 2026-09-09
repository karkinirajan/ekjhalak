// lib/rss-adapter.ts
// Fetches and parses RSS 2.0 and Atom 1.0 feeds.
// Server-only: uses fetch() with Next.js Data Cache revalidation.

// Build-time guard: importing this from a client component is a build
// error rather than a shipped bundle. Fetches and parses feeds; pulls in fast-xml-parser.
import "server-only";

import { XMLParser } from "fast-xml-parser";
import { htmlToText } from "./html-entities";

// ── Types ────────────────────────────────────────────────────────────────────

/** Normalized raw story from any RSS/Atom feed, before NewsItem conversion */
export interface RawStory {
  /** Article title, HTML-stripped */
  title: string;
  /** Canonical article URL */
  url: string;
  /** Summary text, HTML-stripped. May be empty. */
  description: string;
  /** Parsed publication date. null if not present or unparseable. */
  pubDate: Date | null;
  /** Lead image URL from feed metadata. null if not found. */
  imageUrl: string | null;
  /** Feed-provided guid or article URL — used as a fallback id */
  guid: string;
}

const DESCRIPTION_FIELDS = [
  "content:encoded",
  "content",
  "description",
  "summary",
  "excerpt",
  "dc:description",
  "media:description",
] as const;

// ── XML Parser configuration ─────────────────────────────────────────────────

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "__cdata",
  // Raise entity expansion limits — needed for feeds like The Guardian
  processEntities: {
    enabled: true,
    maxEntitySize: 100_000,
    maxExpansionDepth: 20,
    maxTotalExpansions: 50_000,
    maxExpandedLength: 5_000_000,
    maxEntityCount: 5000,
  },
  htmlEntities: true,
  trimValues: true,
  isArray: (name) =>
    // Note: "link" is intentionally excluded — RSS 2.0 uses plain-text <link>, while
    // Atom <link> is handled as object/array by extractAtomLink() which already
    // works with both. Including "link" breaks RSS 2.0 link extraction.
    ["item", "entry", "enclosure", "media:content", "media:thumbnail"].includes(
      name,
    ),
});

// ── HTML utilities ────────────────────────────────────────────────────────────

/**
 * Strip HTML tags and collapse whitespace.
 *
 * Delegates to the shared decoder in lib/html-entities.ts. The version that
 * lived here ended with `.replace(/&#\d+;/g, " ")`, which deleted every numeric
 * entity it had not named individually — and some Nepali newsrooms serve their
 * text entity-encoded, so a Devanagari headline became a row of spaces.
 */
function stripHtml(html: string): string {
  return htmlToText(html);
}

/** Extract string from a field that may be a string, CDATA object, or #text object */
function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("__cdata" in v) return String(v.__cdata ?? "");
    if ("#text" in v) return String(v["#text"] ?? "");
  }
  return "";
}

function extractBestDescription(item: Record<string, unknown>): string {
  let best = "";

  for (const field of DESCRIPTION_FIELDS) {
    const raw = extractText(item[field]);
    const cleaned = stripHtml(raw);
    if (cleaned.length > best.length) {
      best = cleaned;
    }
  }

  return best;
}

// ── Image extraction ──────────────────────────────────────────────────────────

/** Try to extract an image URL from common RSS/media namespace fields */
function extractImageUrl(item: Record<string, unknown>): string | null {
  // media:content array (most common for images)
  const mediaContent = item["media:content"];
  if (Array.isArray(mediaContent)) {
    for (const mc of mediaContent) {
      const url = mc?.["@_url"] ?? mc?.url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
  } else if (mediaContent && typeof mediaContent === "object") {
    const mc = mediaContent as Record<string, unknown>;
    const url = mc["@_url"] ?? mc.url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  // media:thumbnail
  const mediaThumbnail = item["media:thumbnail"];
  if (Array.isArray(mediaThumbnail) && mediaThumbnail[0]) {
    const url = mediaThumbnail[0]["@_url"] ?? mediaThumbnail[0].url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  } else if (mediaThumbnail && typeof mediaThumbnail === "object") {
    const mt = mediaThumbnail as Record<string, unknown>;
    const url = mt["@_url"] ?? mt.url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }

  // enclosure (Podcast / image enclosure)
  const enclosures = item["enclosure"];
  if (Array.isArray(enclosures)) {
    for (const enc of enclosures) {
      const type = enc?.["@_type"] ?? enc?.type ?? "";
      const url = enc?.["@_url"] ?? enc?.url;
      if (
        typeof type === "string" &&
        type.startsWith("image/") &&
        typeof url === "string"
      ) {
        return url;
      }
    }
  }

  // First <img> in description (last resort)
  const desc = extractText(item.description);
  const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];

  return null;
}

// ── Link extraction ───────────────────────────────────────────────────────────

/** Extract article URL from Atom <link> (can be array with multiple rel types) */
function extractAtomLink(links: unknown): string {
  if (Array.isArray(links)) {
    // Prefer rel="alternate"
    const alt = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate");
    const href = alt?.["@_href"] ?? links[0]?.["@_href"];
    if (typeof href === "string") return href;
  }
  if (typeof links === "object" && links !== null) {
    const l = links as Record<string, unknown>;
    const href = l["@_href"];
    if (typeof href === "string") return href;
  }
  if (typeof links === "string") return links;
  return "";
}

// ── Date parsing ──────────────────────────────────────────────────────────────

/** Parse RFC 2822 (RSS) or ISO 8601 (Atom) date strings */
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const cleaned = String(dateStr).trim();
  if (!cleaned) return null;
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

// ── RSS 2.0 / RDF RSS 1.0 item parser ────────────────────────────────────────

function parseRss2Items(container: Record<string, unknown>): RawStory[] {
  const rawItems = container.item;
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((item: Record<string, unknown>): RawStory => {
    const title = stripHtml(extractText(item.title));
    // RDF/RSS 1.0 items store the URL in rdf:about attribute rather than <link>
    const rdfAbout = String(item["@_rdf:about"] ?? item["@_about"] ?? "");
    const link = extractText(item.link) || extractText(item.guid) || rdfAbout;
    const description = extractBestDescription(item);
    const pubDate =
      parseDate(extractText(item.pubDate)) ??
      parseDate(extractText(item["dc:date"])); // RDF feeds often use dc:date
    const imageUrl = extractImageUrl(item);
    const guid = extractText(item.guid) || rdfAbout || link || title;

    return { title, url: link, description, pubDate, imageUrl, guid };
  });
}

// ── Atom 1.0 parser ───────────────────────────────────────────────────────────

function parseAtomEntries(feed: Record<string, unknown>): RawStory[] {
  const rawEntries = feed.entry;
  if (!Array.isArray(rawEntries)) return [];

  return rawEntries.map((entry: Record<string, unknown>): RawStory => {
    const title = stripHtml(extractText(entry.title));
    const url = extractAtomLink(entry.link);
    const description = extractBestDescription(entry);
    const pubDate = parseDate(
      extractText(entry.published) || extractText(entry.updated),
    );
    const imageUrl = extractImageUrl(entry);
    const guid = extractText(entry.id) || url || title;

    return { title, url, description, pubDate, imageUrl, guid };
  });
}

// ── Main fetch function ───────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;
const MAX_DESCRIPTION_LENGTH = 2200;

/**
 * Fetch and parse an RSS or Atom feed.
 * Uses Next.js Data Cache with a 10-minute revalidation.
 * Returns up to 30 stories per source; on failure throws.
 *
 * `deadline`, when given, is the wall-clock the whole regeneration has left.
 * The per-source timeout is clamped to it so a slow outlet cannot spend budget
 * the pass does not have — the sources are fetched in parallel, so the stage
 * costs whatever the slowest single source costs.
 */
export async function fetchRssFeed(
  url: string,
  deadline?: number,
): Promise<RawStory[]> {
  const controller = new AbortController();
  const budget =
    deadline === undefined
      ? FETCH_TIMEOUT_MS
      : Math.max(1, Math.min(FETCH_TIMEOUT_MS, deadline - Date.now()));
  const timeout = setTimeout(() => controller.abort(), budget);

  // The abort has to survive until the body is read, not just until the headers
  // land. Clearing it the moment `fetch` resolved left `response.text()` with no
  // timeout at all, so a source that answered promptly and then dribbled its
  // body held the whole parallel fan-out open for as long as it liked — and
  // because every source is awaited together, one such outlet set the cost of
  // the entire stage.
  let xml: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "EkJhalak-NewsAggregator/1.0 (+https://ekjhalak.news)",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      // Not cached per source, and this is the single most expensive line the
      // pipeline ever had.
      //
      // It was `next: { revalidate: 300 }`. On Vercel that turns every feed
      // response into a Data Cache round trip — twenty-three payloads, several
      // over 100 KB, read and written over the network on every pass. Measured:
      // the same twenty-three feeds fetched with a plain `fetch` and the same
      // 7.5s abort complete in 3.3s wall clock; production was reporting
      // `rss 25468ms` for identical work.
      //
      // And it bought nothing. `aggregateAllSources` only runs on a miss of the
      // outer `unstable_cache`, which revalidates on the same 300s window — so
      // the per-source entry expired at the same moment as the pass that would
      // have read it, and the hit rate was approximately zero. The cost was
      // real and the caching was not.
      //
      // The consequence was the whole pipeline downstream: RSS alone overran
      // AGGREGATE_BUDGET_MS, `slice()` then returned 4–16ms for enrichment, and
      // stage 3 was skipped silently because `enrichMs > 0` was false. The feed
      // shipped with zero translations and the logs blamed the archive.
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    xml = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  if (!xml || xml.length < 50) {
    throw new Error(`Empty or invalid response from ${url}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = PARSER.parse(xml) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`XML parse failed for ${url}: ${(err as Error).message}`);
  }

  let stories: RawStory[];

  if ("rss" in parsed) {
    // RSS 2.0
    const rss = parsed.rss as Record<string, unknown>;
    const channel = rss.channel as Record<string, unknown>;
    if (!channel) throw new Error(`No <channel> in RSS feed ${url}`);
    stories = parseRss2Items(channel);
  } else if ("feed" in parsed) {
    // Atom 1.0
    const feed = parsed.feed as Record<string, unknown>;
    stories = parseAtomEntries(feed);
  } else if ("RDF" in parsed || "rdf:RDF" in parsed) {
    // RDF/RSS 1.0 — items are direct children of the root element, NOT inside <channel>
    const rdf = (parsed["RDF"] ?? parsed["rdf:RDF"]) as Record<string, unknown>;
    // Ensure items is an array (may not be caught by isArray() due to namespace prefix)
    if (rdf.item && !Array.isArray(rdf.item)) {
      rdf.item = [rdf.item];
    }
    stories = parseRss2Items(rdf);
  } else {
    throw new Error(`Unrecognized feed format from ${url}`);
  }

  // Filter out empty/invalid stories and trim description length
  const filtered = stories
    .filter((s) => s.title.length > 2 && s.url.length > 5)
    .map((s) => ({
      ...s,
      description: s.description.slice(0, MAX_DESCRIPTION_LENGTH),
    }))
    .slice(0, 30);

  // This used to be the point where every story with a short description had its
  // article page scraped for a longer one. That work now lives in
  // lib/article-extractor.ts, which does the same job later in the pass, in
  // ranked order, against the regeneration's deadline, and with a better ladder
  // (JSON-LD articleBody, then og:description, then paragraphs).
  //
  // Keeping both meant fetching every article page twice per pass, and the copy
  // that lived here was the unbounded one: batches of four, five seconds each,
  // walked sequentially over as many as thirty stories — up to forty seconds for
  // a single source, inside a stage every other source is awaited alongside. On
  // a cold deploy, with nothing in the fetch cache, that is the whole request
  // budget spent before the model stage is even reached.
  return filtered;
}

