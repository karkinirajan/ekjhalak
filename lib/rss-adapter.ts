// lib/rss-adapter.ts
// Fetches and parses RSS 2.0 and Atom 1.0 feeds.
// Server-only: uses fetch() with Next.js Data Cache revalidation.

import { XMLParser } from "fast-xml-parser";

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

/** Strip HTML tags and collapse whitespace */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, " - ")
    .replace(/&hellip;/gi, "…")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, "…")
    .replace(/&#x2018;|&#x2019;/gi, "'")
    .replace(/&#x201c;|&#x201d;/gi, '"')
    .replace(/&#x2026;/gi, "…")
    .replace(/&#\d+;/g, " ")
    .replace(/&#x[0-9a-f]+;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
const ENRICH_TIMEOUT_MS = 5_000;
const MAX_DESCRIPTION_LENGTH = 2200;
/** Descriptions shorter than this trigger article-page enrichment */
const SHORT_DESCRIPTION_THRESHOLD = 200;
/** Max concurrent article-page fetches for enrichment */
const ENRICH_CONCURRENCY = 4;

/**
 * Fetch and parse an RSS or Atom feed.
 * Uses Next.js Data Cache with a 10-minute revalidation.
 * Returns up to 30 stories per source; on failure throws.
 */
export async function fetchRssFeed(url: string): Promise<RawStory[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "EkJhalak-NewsAggregator/1.0 (+https://www.ekjhalak.news)",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      // Next.js Data Cache: revalidate every 5 minutes per source URL
      next: { revalidate: 300 },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const xml = await response.text();
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

  // Enrich stories that have short descriptions by scraping article pages
  await enrichShortDescriptions(filtered);

  return filtered;
}

// ── Article page enrichment ───────────────────────────────────────────────────

/** Detect navigation/boilerplate text (e.g. "Home News Sport Business ...") */
function looksLikeBoilerplate(text: string): boolean {
  // Many short capitalized words in sequence = likely nav menu
  const words = text.split(/\s+/);
  if (words.length > 8) {
    const shortCapWords = words.filter(
      (w) => w.length <= 12 && /^[A-Z]/.test(w),
    );
    if (shortCapWords.length / words.length > 0.6) return true;
  }
  // Common boilerplate patterns
  if (
    /^(Home|News|Sport|Menu|Navigation|Copyright|Follow us|Share|Subscribe|Sign up|Cookie|Accept|Related)/i.test(
      text,
    )
  )
    return true;
  return false;
}

/** Count meaningful <p> tags in an HTML fragment */
function countParagraphs(fragment: string): number {
  let count = 0;
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(fragment)) !== null) {
    const text = stripHtml(m[1]);
    if (text.length > 50 && !looksLikeBoilerplate(text)) count++;
  }
  return count;
}

/**
 * Find the best content container in HTML. Tries common article container
 * patterns and picks the one with the most paragraph content.
 * Falls back to full HTML with nav/header/footer stripped.
 */
function findArticleBody(html: string): string {
  const patterns = [
    /<article[^>]*class="[^"]*(?:story|article|post|content)[^"]*"[^>]*>([\s\S]+)<\/article>/i,
    /<section[^>]*class="[^"]*(?:story|article|content)[^"]*"[^>]*>([\s\S]+)<\/section>/i,
    /<div[^>]*class="[^"]*(?:article-body|story-body|post-content|entry-content|story-section)[^"]*"[^>]*>([\s\S]+?)<\/div>/i,
  ];

  let best = "";
  let bestScore = 0;

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && m[1].length > 200) {
      const score = countParagraphs(m[1]);
      if (score > bestScore) {
        bestScore = score;
        best = m[1];
      }
    }
  }

  if (bestScore > 0) return best;

  // Remove <header>, <footer>, <nav>, <aside> sections to reduce noise
  return html
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");
}

/**
 * Extract body text from an article page by pulling `<p>` tag content.
 * Falls back to og:description / meta description if body extraction fails.
 */
async function scrapeArticleDescription(articleUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);

  try {
    const response = await fetch(articleUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "EkJhalak-NewsAggregator/1.0 (+https://www.ekjhalak.news)",
        Accept: "text/html",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) return "";

    const html = await response.text();
    const searchHtml = findArticleBody(html);

    // 1. Try extracting <p> tags from the article body (best quality)
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match: RegExpExecArray | null;
    while ((match = pRegex.exec(searchHtml)) !== null) {
      const text = stripHtml(match[1]);
      // Skip short paragraphs (captions, bylines) and boilerplate
      if (text.length > 50 && !looksLikeBoilerplate(text)) {
        paragraphs.push(text);
      }
    }

    if (paragraphs.length > 0) {
      // Take enough paragraphs to build a substantial description
      let combined = "";
      for (const p of paragraphs) {
        if (combined.length >= MAX_DESCRIPTION_LENGTH) break;
        combined += (combined ? " " : "") + p;
      }
      return combined.slice(0, MAX_DESCRIPTION_LENGTH);
    }

    // 2. Fallback: og:description or meta description
    const ogMatch =
      html.match(
        /<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:description["']/i,
      );
    if (ogMatch && ogMatch[1].length > 50) return stripHtml(ogMatch[1]);

    const metaMatch =
      html.match(
        /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i,
      );
    if (metaMatch && metaMatch[1].length > 50) return stripHtml(metaMatch[1]);

    return "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Enrich stories in-place: for any story whose description is shorter than
 * SHORT_DESCRIPTION_THRESHOLD, attempt to scrape a better description from
 * the article page. Runs with limited concurrency to avoid overwhelming sources.
 */
async function enrichShortDescriptions(stories: RawStory[]): Promise<void> {
  const toEnrich = stories.filter(
    (s) => s.description.length < SHORT_DESCRIPTION_THRESHOLD && s.url,
  );

  if (toEnrich.length === 0) return;

  // Process in batches to limit concurrency
  for (let i = 0; i < toEnrich.length; i += ENRICH_CONCURRENCY) {
    const batch = toEnrich.slice(i, i + ENRICH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((s) => scrapeArticleDescription(s.url)),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      if (
        result.status === "fulfilled" &&
        result.value.length > batch[j].description.length
      ) {
        batch[j].description = result.value.slice(0, MAX_DESCRIPTION_LENGTH);
      }
    }
  }
}
