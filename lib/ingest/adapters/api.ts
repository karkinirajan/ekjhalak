// lib/ingest/adapters/api.ts
// JSON/REST API adapter for sources that expose a structured endpoint.
// Used when a source has api_url set and source_type = 'api'.
//
// Contract: adapter receives the source record and returns RawStory[].
// Callers are responsible for error handling and timeouts.

import type { Source } from "@/lib/source-registry";
import type { RawStory } from "./rss";

/**
 * Fetch articles from a structured JSON API source.
 *
 * The API response is expected to be an array of objects (or an object with a
 * well-known array key like `articles`, `items`, `data`, or `results`).
 * Each item is mapped to a RawStory with best-effort field detection.
 *
 * For sources with custom shapes, extend the field map below.
 */
export async function fetchApiSource(
  source: Source,
  apiUrl: string,
  signal?: AbortSignal,
): Promise<RawStory[]> {
  const url = apiUrl || source.homepageUrl;
  if (!url) return [];

  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json", "User-Agent": "EkJhalak/1.0" },
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`API fetch failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  // Normalise to an array regardless of root shape
  const items: unknown[] = Array.isArray(json)
    ? json
    : (json.articles ?? json.items ?? json.data ?? json.results ?? []);

  return items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => toRawStory(item, url));
}

// ── Field mapping ─────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function toRawStory(item: Record<string, unknown>, sourceUrl: string): RawStory {
  const title =
    str(item.title) || str(item.headline) || str(item.name) || "(no title)";

  const url =
    str(item.url) || str(item.link) || str(item.href) || str(item.webUrl) || sourceUrl;

  const description =
    str(item.description) || str(item.summary) || str(item.excerpt) || str(item.body) || "";

  const pubDateRaw = item.publishedAt ?? item.published_at ?? item.pubDate ?? item.date ?? item.created_at;
  const pubDate = pubDateRaw ? safeDate(pubDateRaw) : null;

  const imageUrl =
    str(item.imageUrl) ||
    str(item.image_url) ||
    str(item.thumbnail) ||
    str(item.urlToImage) ||
    null;

  const guid = str(item.id) || str(item.guid) || url;

  return { title, url, description, pubDate, imageUrl: imageUrl || null, guid };
}

function safeDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}
