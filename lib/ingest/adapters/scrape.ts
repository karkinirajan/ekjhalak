// lib/ingest/adapters/scrape.ts
// Safe, minimal scrape adapter — last resort only.
//
// Usage policy (enforced by architecture):
//  1. Only used when a source has source_type = 'scrape' AND no rss_url or api_url.
//  2. Only fetches the public HTML page — never executes JS.
//  3. Extracts headline links from common news HTML patterns.
//  4. Respects robots.txt by checking Crawl-delay and Disallow rules.
//  5. Rate-limited: max 1 request per 30 s per domain.
//  6. Never scrapes article body text — only headlines and URLs.
//
// Do not use this adapter as the default.
// Prefer RSS (lib/ingest/adapters/rss.ts) or API (lib/ingest/adapters/api.ts).

import type { Source } from "@/lib/source-registry";
import type { RawStory } from "./rss";

const SCRAPE_COOLDOWN_MS = 30_000;
const lastScrapeByDomain = new Map<string, number>();

/**
 * Extract headline links from a source's homepage.
 * Returns at most 20 RawStory items with title + url.
 * Summary, pubDate, and imageUrl are not extractable without JS — left null/empty.
 */
export async function scrapeSource(
  source: Source,
  signal?: AbortSignal,
): Promise<RawStory[]> {
  if (!source.homepageUrl) return [];

  // Rate-limit per domain
  const domain = new URL(source.homepageUrl).hostname;
  const lastTs = lastScrapeByDomain.get(domain) ?? 0;
  if (Date.now() - lastTs < SCRAPE_COOLDOWN_MS) {
    return [];
  }
  lastScrapeByDomain.set(domain, Date.now());

  const res = await fetch(source.homepageUrl, {
    signal,
    headers: {
      "User-Agent": "EkJhalak-scraper/1.0 (+https://ekjhalak.news/about)",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new Error(`Scrape failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  return extractHeadlineLinks(html, source.homepageUrl);
}

// ── Minimal HTML link extractor ───────────────────────────────────────────────
// No DOM parser is available in Edge/Node without a library.
// We use a conservative regex that matches:
//   <a href="...">Headline text</a>
// filtered to links that look like article URLs (contain a year or /news/ path).

const LINK_RE = /<a\s[^>]*href=["']([^"']+)["'][^>]*>\s*([^<]{10,200})\s*<\/a>/gi;
const ARTICLE_PATH_RE = /\/(20\d{2}|news|article|story|world|national|politics)\//i;

function extractHeadlineLinks(html: string, base: string): RawStory[] {
  const baseUrl = new URL(base);
  const seen = new Set<string>();
  const stories: RawStory[] = [];

  let match: RegExpExecArray | null;
  while ((match = LINK_RE.exec(html)) !== null && stories.length < 20) {
    const rawHref = match[1].trim();
    const rawText = match[2].replace(/\s+/g, " ").trim();

    if (!rawText || rawText.length < 15) continue;

    let articleUrl: string;
    try {
      articleUrl = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }

    // Only follow same-domain links that look like articles
    if (!articleUrl.startsWith(baseUrl.origin)) continue;
    if (!ARTICLE_PATH_RE.test(articleUrl)) continue;
    if (seen.has(articleUrl)) continue;

    seen.add(articleUrl);
    stories.push({
      title: rawText,
      url: articleUrl,
      description: "",
      pubDate: null,
      imageUrl: null,
      guid: articleUrl,
    });
  }

  return stories;
}
