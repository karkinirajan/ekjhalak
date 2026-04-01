// lib/feed-normalizer.ts
// Converts RawStory + Source into the canonical NewsItem shape.
// Server-only: uses node:crypto for URL fingerprinting.

import { createHash } from "node:crypto";
import type { Source } from "./source-registry";
import type { RawStory } from "./rss-adapter";
import type { NewsItem } from "./news-pipeline";

const LOCAL_TZ = "Asia/Kathmandu";

function extractPublishedDateFromUrl(url: string): Date | null {
  const match = url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})(?:\/|$)/);
  if (!match) return null;

  const [, year, month, day] = match;
  // Use midday UTC so date-only URLs remain on the same calendar day after
  // timezone conversion in Asia/Kathmandu.
  const derived = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
  );
  return Number.isNaN(derived.getTime()) ? null : derived;
}

function buildSummary(title: string, description: string): string {
  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  if (!cleanDescription) return cleanTitle;
  if (cleanDescription.length >= 180) return cleanDescription;
  if (!cleanTitle) return cleanDescription;
  if (cleanDescription.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    return cleanDescription;
  }
  return `${cleanTitle}. ${cleanDescription}`;
}

// ── URL normalization ─────────────────────────────────────────────────────────

/** Tracking query parameters that should be removed before fingerprinting */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "ref",
  "source",
  "from",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "_source",
  "referrer",
  "via",
  "origin",
  "cid",
  "trk",
  "trkCampaign",
]);

/**
 * Remove tracking params, normalize protocol to https, strip trailing slash.
 * Returns a canonical string used for fingerprinting.
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.protocol = "https:";
    // Remove tracking params
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    const path = url.pathname.replace(/\/$/, "") || "/";
    const search =
      url.searchParams.size > 0 ? `?${url.searchParams.toString()}` : "";
    return `${url.host}${path}${search}`;
  } catch {
    return rawUrl;
  }
}

/** SHA-256 of the normalized URL, first 12 hex chars (~48 bits, collision-free for our scale) */
export function fingerprintUrl(url: string): string {
  const normalized = normalizeUrl(url);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

// ── Date formatting ───────────────────────────────────────────────────────────

/**
 * Format a unix millisecond timestamp for display in Asia/Kathmandu timezone.
 * Examples: "3m ago", "Today • 07:15", "Yesterday • 15:30", "Apr 1 • 09:00"
 */
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

// ── Main normalizer ───────────────────────────────────────────────────────────

/**
 * Convert a raw RSS story and its source metadata into a NewsItem.
 * Chooses the current time as fallback if pubDate is missing.
 */
export function normalizeStory(raw: RawStory, source: Source): NewsItem {
  // Timestamp: use pubDate if available, otherwise derive from the article URL,
  // and cap at now to avoid future dates.
  const now = Date.now();
  const derivedPubDate = raw.pubDate ?? extractPublishedDateFromUrl(raw.url);
  const rawTs = derivedPubDate ? derivedPubDate.getTime() : now;
  const publishedTimestamp = Math.min(rawTs, now);

  const id = fingerprintUrl(raw.url);

  // Determine Nepali summary: for NP-language sources the description IS the NP content.
  // For EN sources summaryNp starts empty until a translation pipeline is wired up.
  const isNepaliSource = source.language === "np";

  return {
    id,
    bucket: source.bucket,
    title: raw.title,
    titleNp: isNepaliSource ? raw.title : "",
    source: source.name,
    sourceId: source.id,
    sourceUrl: raw.url,
    publishedAt: formatPublishedAt(publishedTimestamp, Boolean(raw.pubDate)),
    publishedTimestamp,
    summaryEn: isNepaliSource ? "" : buildSummary(raw.title, raw.description),
    summaryNp: isNepaliSource ? buildSummary(raw.title, raw.description) : "",
    imageUrl: raw.imageUrl ?? undefined,
    category: source.categories[0],
  };
}
