// lib/feed-normalizer.ts
// Converts RawStory + Source into a canonical NewsItem. Server-only.

import { createHash } from "node:crypto";
import type { Source } from "./source-registry";
import type { RawStory } from "./rss-adapter";
import type { NewsItem } from "./news-pipeline";
import { classifyTopic, looksBreaking } from "./taxonomy";

const LOCAL_TZ = "Asia/Kathmandu";

function extractPublishedDateFromUrl(url: string): Date | null {
  const match = url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})(?:\/|$)/);
  if (!match) return null;
  const [, year, month, day] = match;
  const derived = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
  );
  return Number.isNaN(derived.getTime()) ? null : derived;
}

/**
 * Publisher chrome that arrives inside the description field.
 *
 * `extractBestDescription()` picks the longest candidate field, and for several
 * paywalled outlets the longest thing in the item is their subscription pitch.
 * In a live 475-story feed, 26 cards led with this instead of news — The Hindu
 * ×20, The Guardian ×4, BBC ×2:
 *
 *   "Account subscription benefits alongside Premium Stories, Editorials,
 *    Opinions and more. Unlock these with Subscription Markets regulator SEBI…"
 *
 * The real story is appended after the pitch, so this strips rather than
 * rejects — what survives is usually a perfectly good standfirst.
 */
const BOILERPLATE_PATTERNS: RegExp[] = [
  // Paywall and signup pitches, wherever they appear in the field.
  /(?:account\s+)?subscription benefits[\s\S]*?unlock these with subscription/gi,
  /\bunlock these with subscription\b/gi,
  /\b(?:to continue reading|continue reading|read more at|sign up (?:to|for)|subscribe (?:to|now)|already a subscriber)\b[^.]*\.?/gi,
  /\bthis (?:article|story) (?:first )?appeared (?:first )?on\b[^.]*\.?/gi,
  // Trailing wire metadata some feeds staple to the description.
  /\bpublished\s*[-–—]\s*\w+\s+\d{1,2},\s*\d{4}\s*[\d:]*\s*(?:am|pm|ist|utc|npt)?\b/gi,
  /\b(?:©|copyright)\s*\d{4}[^.]*\.?/gi,
  /\ball rights reserved\.?/gi,
  // Section labels some CMSes prepend to the body ("Shorts News:…" — The Hindu).
  /^\s*(?:shorts news|video|watch|live|premium|exclusive)\s*:\s*/i,
];

function stripBoilerplate(text: string): string {
  let out = text;
  for (const pattern of BOILERPLATE_PATTERNS) out = out.replace(pattern, " ");
  return out.replace(/\s+/g, " ").trim();
}

/** Same words, ignoring punctuation and case — used to catch echoed headlines. */
function looksLikeTitle(title: string, candidate: string): boolean {
  const strip = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const t = strip(title);
  const c = strip(candidate);
  if (!t || !c) return false;
  // The description is the headline, or the headline plus a few stray glyphs.
  return c === t || (c.startsWith(t) && c.length - t.length < 12);
}

/**
 * The standfirst shown under a headline — or nothing.
 *
 * Returning "" is a real answer here. This used to fall back to the headline
 * whenever a feed shipped no description, which put 52 of 475 live cards in the
 * state of printing their own headline twice, once large and once small. A card
 * with a headline and no standfirst is clean; a card that repeats itself reads
 * as a bug. `StoryCard` and `StoryReader` both render the summary conditionally,
 * so an empty string simply omits the paragraph.
 */
function buildSummary(title: string, description: string): string {
  const cleanTitle = title.trim();
  let body = stripBoilerplate(description.trim());

  // Feeds that repeat the headline at the head of the body (NDTV, The Hindu,
  // NYT and Al Jazeera all do it) get it removed. This used to be *added* — a
  // short description was returned as `${title}. ${description}` — which put
  // the headline on the card twice, once as the h3 and again as the first
  // clause of the standfirst directly beneath it. The headline is always
  // rendered adjacent to the summary, so it is never context the summary needs
  // to supply.
  if (cleanTitle && body.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    body = body.slice(cleanTitle.length).replace(/^[\s.:;,–—-]+/, "");
  }

  if (!body) return "";
  if (looksLikeTitle(cleanTitle, body)) return "";
  // Too short to say anything the headline did not already say.
  if (body.length < 40) return "";

  return body;
}

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "ref", "source", "from", "fbclid", "gclid", "mc_cid", "mc_eid",
  "_source", "referrer", "via", "origin", "cid", "trk", "trkCampaign",
]);

export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.protocol = "https:";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    const path = url.pathname.replace(/\/$/, "") || "/";
    const search =
      url.searchParams.size > 0 ? `?${url.searchParams.toString()}` : "";
    return `${url.host}${path}${search}`;
  } catch {
    return rawUrl;
  }
}

export function fingerprintUrl(url: string): string {
  return createHash("sha256").update(normalizeUrl(url)).digest("hex").slice(0, 12);
}

export function formatPublishedAt(
  timestampMs: number,
  includeTime = true,
): string {
  const date = new Date(timestampMs);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: LOCAL_TZ,
  });
  if (!includeTime) return dateStr;
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: LOCAL_TZ,
  });
  return `${dateStr} • ${timeStr}`;
}

/**
 * Feeds hand us relative paths, http:// URLs and tracking pixels alongside real
 * lead images. Only absolute https images are worth rendering — anything else
 * falls back to generated cover art in the UI.
 */
function sanitizeImageUrl(candidate: string | null): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate.trim());
    if (url.protocol !== "https:") return null;
    // Reject 1x1 tracking beacons that some feeds ship as media:content
    if (/\b(1x1|pixel|spacer|blank)\b/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export function normalizeStory(raw: RawStory, source: Source): NewsItem {
  const now = Date.now();
  const derivedPubDate = raw.pubDate ?? extractPublishedDateFromUrl(raw.url);
  const rawTs = derivedPubDate ? derivedPubDate.getTime() : now;
  const publishedTimestamp = Math.min(rawTs, now);

  const summary = buildSummary(raw.title, raw.description);

  // "Breaking" is only meaningful while a story is actually fresh — a
  // three-day-old headline that still says LIVE UPDATES is not breaking news.
  const isFresh = now - publishedTimestamp < THREE_HOURS_MS;
  const topic =
    isFresh && looksBreaking(raw.title)
      ? "breaking"
      : classifyTopic(raw.title, summary, source.categories);

  return {
    id: fingerprintUrl(raw.url),
    bucket: source.bucket,
    originalLang: source.language === "np" ? "np" : "en",
    title: raw.title,
    sourceUrl: raw.url,
    publishedAt: formatPublishedAt(publishedTimestamp, Boolean(raw.pubDate)),
    publishedTimestamp,
    summary,
    category: source.categories[0],
    topic,
    imageUrl: sanitizeImageUrl(raw.imageUrl),
    sourceId: source.id,
    sourceName: source.name,
    sourceHomepage: source.homepageUrl,
    credibility: source.credibilityScore ?? 5,
    coverageCount: 1,
  };
}
