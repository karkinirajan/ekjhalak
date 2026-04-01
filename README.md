# Ek Jhalak — Nepal & World News Aggregator

Real-time news aggregator pulling from 14 live RSS/Atom sources covering Nepal and the world, built with Next.js 16 App Router.

Live: [ekjhalak.vercel.app](https://ekjhalak.vercel.app)

---

## Architecture Overview

```
Browser (React Client)
  │  5-min auto-refresh poll
  ▼
app/page.tsx  — client component, manages source filter + loading state
  │  fetch /api/news?range=day|week|month
  ▼
app/api/news/route.ts  — Route Handler
  │  getCachedFeed()  [unstable_cache, 10-min TTL, tag: "news-feed"]
  ▼
lib/aggregator.ts  — parallel ingestion
  │  Promise.allSettled over all active sources
  │  per-source errors isolated — one bad source does not affect others
  ▼
lib/rss-adapter.ts  — fetch + parse
  │  AbortController (10s timeout per source)
  │  next: { revalidate: 600 }  [Next.js Data Cache, per-URL]
  │  fast-xml-parser  (RSS 2.0, Atom 1.0, RDF/RSS 1.0)
  ▼
lib/feed-normalizer.ts  — raw → NewsItem
  │  URL fingerprint (SHA-256, first 12 hex chars)
  │  tracking param stripping (utm_*, fbclid, gclid, …)
  │  timestamp capped at Date.now() (rejects future-dated items)
  ▼
lib/deduplicator.ts  — two-pass dedup
  │  Pass 1: exact URL fingerprint match
  │  Pass 2: Jaccard title similarity ≥ 0.65 within 2-hour window
  ▼
AggregatedFeed  { items: NewsItem[], sourceStatuses, fetchedAt }
```

---

## Caching & Revalidation

Two independent cache layers run in series:

| Layer | Mechanism | TTL | Scope |
|-------|-----------|-----|-------|
| Per-source fetch | `fetch(..., { next: { revalidate: 600 } })` | 10 min | One RSS URL |
| Full aggregation | `unstable_cache` tagged `"news-feed"` | 10 min | All sources combined |

A cache miss at the aggregation layer fetches all sources in parallel. A hit returns the stored `AggregatedFeed` immediately with no upstream I/O.

On-demand invalidation: call `revalidateTag("news-feed")` (e.g. from a webhook or admin route) to force a fresh fetch on the next request.

---

## Source Model

Sources are defined in `lib/source-registry.ts`. Each source has:

```ts
interface Source {
  id: string          // stable slug, used as DB-style key
  name: string
  bucket: "national" | "international"
  country: string     // ISO 3166-1 alpha-2
  language: "en" | "np" | "multi"
  categories: string[]
  rssUrl: string | null  // null = no public feed
  homepageUrl: string
  priority: number    // 1–10; higher wins dedup ties, controls sidebar order
  active: boolean     // false = skip during aggregation
  note: string
  urlPrefix?: string  // only keep items whose URL starts with this (e.g. CNN ad filter)
}
```

**Active sources (14 confirmed working):**

| Source | Bucket | Format |
|--------|--------|--------|
| Kathmandu Post | National | RSS 2.0 |
| Onlinekhabar English | National | RSS 2.0 |
| The Rising Nepal | National | RSS 2.0 |
| BBC | International | Atom 1.0 |
| Al Jazeera | International | RSS 2.0 |
| The Guardian | International | Atom 1.0 |
| DW | International | RDF/RSS 1.0 |
| France 24 | International | RSS 2.0 |
| The Hindu | International | RSS 2.0 |
| Times of India | International | RSS 2.0 |
| NDTV | International | RSS 2.0 (FeedBurner) |
| The New York Times | International | RSS 2.0 |
| Politico Europe | International | RSS 2.0 |
| CNN | International | RSS 2.0 (ad-filtered) |

**Inactive sources** (registered but not fetched): Reuters (blocks server-side IPs), AP News (no free RSS), Washington Post/WSJ/Bloomberg (paywalled), eKantipur/Gorkhapatra (feed issues), Instagram sources.

---

## Deduplication Strategy

Items arrive sorted by priority descending (high-priority source version wins).

**Pass 1 — URL fingerprint:** SHA-256 of the canonical URL (tracking params stripped), first 12 hex chars as `id`. Exact collisions are dropped.

**Pass 2 — Title similarity:** For each unpruned item, compare against all already-kept items published within a 2-hour window. Tokenize titles (lowercase, strip punctuation, 3+ char words), compute Jaccard similarity. If ≥ 0.65 → duplicate, drop.

This removes cross-source reposts (e.g. Reuters story syndicated to multiple outlets) while keeping genuinely different articles on the same topic.

---

## Range Filtering

The `/api/news` endpoint accepts `?range=day|week|month`:

| Range | Cutoff |
|-------|--------|
| `day` | 24 hours |
| `week` | 7 days |
| `month` | 30 days |

Filtering is applied against `item.publishedTimestamp` relative to `feed.fetchedAt`. Items without a parseable publication date are assigned `Date.now()` at ingest time and always appear in `day`.

---

## How to Add a Source

1. Open `lib/source-registry.ts`.
2. Add an entry to `SOURCES`:
   ```ts
   {
     id: "your-source",        // lowercase, hyphenated, unique
     name: "Your Source",
     bucket: "national",       // or "international"
     country: "NP",
     language: "en",
     categories: ["national"],
     rssUrl: "https://example.com/feed",
     homepageUrl: "https://example.com",
     priority: 7,              // 1–10
     active: true,
     note: "Short description",
   },
   ```
3. Test the feed URL with `curl -s https://example.com/feed | head -c 500` — confirm it returns XML.
4. Set `active: false` initially; run the dev server and check `/api/news` source statuses before enabling.
5. If the source injects sponsored/ad items into the RSS feed, add `urlPrefix: "https://example.com/"` to filter them out.

---

## Local Setup

```bash
# Clone and install
git clone <repo>
cd ek-jhalak
pnpm install

# Run dev server
pnpm dev
# → http://localhost:3000

# Check source health
curl http://localhost:3000/api/sources | jq '.[] | {name, ok, itemCount}'

# Check news feed
curl 'http://localhost:3000/api/news?range=day' | jq '{total: (.items | length), sources: [.meta.sourceStatuses[] | {name, ok, itemCount}]}'
```

**No environment variables required** for local development. The aggregator fetches public RSS feeds directly.

---

## API Endpoints

### `GET /api/news`

Query params: `range=day|week|month` (default: `day`), `bucket=national|international`

Response:
```json
{
  "items": [...],
  "meta": {
    "total": 231,
    "fetchedAt": 1234567890000,
    "sourceStatuses": [
      { "id": "bbc", "name": "BBC", "ok": true, "itemCount": 30, "fetchedAt": 1234567890000 }
    ]
  }
}
```

### `GET /api/sources`

Returns all registered sources with live fetch status merged in.

---

## Production Notes

- **Cold start:** First request after a deploy triggers parallel fetching of all 14 sources (~3–5s). Subsequent requests within 10 minutes are cache hits.
- **Image optimization:** `next/image` is configured with `remotePatterns` for all active source domains. Unknown image hosts fall back gracefully (no image shown).
- **Error isolation:** A source that times out, returns HTTP 4xx/5xx, or emits malformed XML produces a `SourceStatusMeta` with `ok: false`. The rest of the feed is unaffected.
- **Cache invalidation:** To force an immediate refresh (e.g. after adding a source), delete `.next/cache` and restart the server, or call `revalidateTag("news-feed")` from a protected admin route.
- **Reuters:** Blocked from server-side fetches on shared-IP hosting (Vercel, Render, etc.). Re-enable with a dedicated egress IP or a proxy.
