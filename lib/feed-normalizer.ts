// lib/feed-normalizer.ts
// Converts RawStory + Source into a canonical NewsItem. Server-only.

import { createHash } from "node:crypto";
import type { Source } from "./source-registry";
import type { RawStory } from "./rss-adapter";
import type { NewsItem } from "./news-pipeline";

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

export function normalizeStory(raw: RawStory, source: Source): NewsItem {
  const now = Date.now();
  const derivedPubDate = raw.pubDate ?? extractPublishedDateFromUrl(raw.url);
  const rawTs = derivedPubDate ? derivedPubDate.getTime() : now;
  const publishedTimestamp = Math.min(rawTs, now);

  return {
    id: fingerprintUrl(raw.url),
    bucket: source.bucket,
    originalLang: source.language === "np" ? "np" : "en",
    title: raw.title,
    sourceUrl: raw.url,
    publishedAt: formatPublishedAt(publishedTimestamp, Boolean(raw.pubDate)),
    publishedTimestamp,
    summary: buildSummary(raw.title, raw.description),
    category: source.categories[0],
  };
}
