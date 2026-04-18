# एक झलक — Nepal & World News

Nepali news consumption has quietly become exhausting. Facebook timelines bury serious reporting under reactions and reposts. TikTok delivers clips stripped of context. WhatsApp groups circulate screenshots of screenshots — with no source, no date, no accountability. By the time a story reaches you, it has been amplified, clipped, and stripped of everything that made it verifiable. The noise is relentless. The signal is thin.

Ek Jhalak (एक झलक — "a single glance") was built as an antidote to that. It pulls from a curated set of trusted Nepali and international publishers — Kathmandu Post, Setopati, BBC, The Guardian, Al Jazeera, and more — and presents everything in one clean, chronological, ad-free interface. No algorithmic ranking. No engagement bait. No infinite scroll. Just the news, directly from the source, in the order it happened.

It is bilingual by design. Native Nepali content from Setopati, Ratopati, and Nagarik News is shown in Devanagari. English-language stories are readable in English or translated to Nepali on demand. The interface adapts cleanly to both scripts. The goal is one reliable place where you can actually read the news — fast, honest, and clutter-free.

Live: [www.ekjhalak.news](https://www.ekjhalak.news)

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

| Layer            | Mechanism                                   | TTL   | Scope                |
| ---------------- | ------------------------------------------- | ----- | -------------------- |
| Per-source fetch | `fetch(..., { next: { revalidate: 300 } })` | 5 min | One RSS URL          |
| Full aggregation | `unstable_cache` tagged `"news-feed"`       | 5 min | All sources combined |
| Page HTML        | ISR (`export const revalidate = 300`)       | 5 min | Rendered page        |

A cache miss at the aggregation layer fetches all sources in parallel. A hit returns the stored `AggregatedFeed` immediately with no upstream I/O.

On-demand invalidation: `POST /api/revalidate` calls `revalidateTag("news-feed", "max")` to bust the tag across all cache layers. A Vercel Cron running once per day keeps the cache warm within hobby-plan limits.

---

## Source Model

Sources are defined in `lib/source-registry.ts`. Each source has:

```ts
interface Source {
  id: string; // stable slug, used as DB-style key
  name: string;
  bucket: "national" | "international";
  country: string; // ISO 3166-1 alpha-2
  language: "en" | "np" | "multi";
  categories: string[];
  rssUrl: string | null; // null = no public feed
  homepageUrl: string;
  priority: number; // 1–10; higher wins dedup ties, controls sidebar order
  active: boolean; // false = skip during aggregation
  note: string;
  urlPrefix?: string; // only keep items whose URL starts with this (e.g. CNN ad filter)
  credibilityScore?: number; // 1–10 editorial quality signal, shown in UI
}
```

**Active sources (22 confirmed):**

| Source                   | Bucket        | Language |
| ------------------------ | ------------- | -------- |
| Kathmandu Post           | National      | EN       |
| Onlinekhabar English     | National      | EN       |
| My Republica             | National      | EN       |
| The Himalayan Times      | National      | EN       |
| The Rising Nepal         | National      | EN       |
| Setopati English         | National      | EN       |
| Setopati                 | National      | **NP**   |
| Ratopati                 | National      | **NP**   |
| Nagarik News             | National      | **NP**   |
| BBC                      | International | EN       |
| Al Jazeera               | International | EN       |
| The Guardian             | International | EN       |
| DW                       | International | EN       |
| France 24                | International | EN       |
| The Hindu                | International | EN       |
| Times of India           | International | EN       |
| NDTV                     | International | EN       |
| The New York Times       | International | EN       |
| Politico Europe          | International | EN       |
| CNN                      | International | EN       |
| South China Morning Post | International | EN       |

**Inactive sources** (registered but not fetched): Reuters (blocks server-side IPs), AP News (no free RSS), Washington Post/WSJ/Bloomberg (paywalled), eKantipur/Gorkhapatra (feed issues), Instagram sources.

---

## Deduplication Strategy

Items arrive sorted by priority descending (high-priority source version wins).

**Pass 1 — URL fingerprint:** SHA-256 of the canonical URL (tracking params stripped), first 12 hex chars as `id`. Exact collisions are dropped; the canonical item records the alternate `sourceId` in `alternateSourceIds[]`.

**Pass 2 — Title similarity:** For each unpruned item, compare against all already-kept items published within a 2-hour window. Tokenize titles (lowercase, strip punctuation, 3+ char words), compute Jaccard similarity. If ≥ 0.65 → duplicate, drop; canonical item records `alternateSourceIds` and `duplicateCount`.

**UI surface:** The NewsCard shows "also reported by N sources" when `alternateSourceIds.length > 0`, and the reading sheet lists those source names.

This removes cross-source reposts while preserving source diversity and attribution.

---

## Range Filtering

The `/api/news` endpoint accepts `?range=day|week|month`:

| Range   | Cutoff   |
| ------- | -------- |
| `day`   | 24 hours |
| `week`  | 7 days   |
| `month` | 30 days  |

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
npm install

# Copy and configure environment (optional — app works without keys)
cp .env.example .env.local
# Set GROQ_API_KEY to enable EN→NP translation and summarization

# Run dev server
npm run dev
# → http://localhost:3000

# Check source health
curl http://localhost:3000/api/sources | jq '.sources[] | {name, active, status}'

# Check news feed
curl 'http://localhost:3000/api/news?range=day' | jq '{total: (.items | length), sources: [.meta.sourceStatuses[] | {name, ok, itemCount}]}'
```

**No environment variables required** for local development. The aggregator fetches public RSS feeds directly. Without `GROQ_API_KEY`, translation is skipped and English summaries are shown in both language modes.

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

### `POST /api/revalidate?secret=SECRET`

On-demand cache invalidation. Busts the `"news-feed"` tag immediately — next request triggers a fresh aggregation. Use from a Vercel Cron job (once per day on hobby accounts) for periodic freshness.

Set `REVALIDATE_SECRET` in Vercel environment variables. Without it, the endpoint is open (fine for dev/staging).

---

## Nepali Language Support

**Native NP sources:** Setopati, Ratopati, and Nagarik News deliver content in Nepali script. Their `summaryNp` is populated directly from the RSS `description` field — no translation required.

**EN→NP translation:** English-language sources have their titles and summaries translated inside the `unstable_cache` boundary in `lib/aggregator.ts` — so translation runs once per 5-minute window, not on every request.

Translation cascade (priority order):

1. **Groq LLM** (`llama-3.3-70b-versatile`) — batch mode, ~15 texts per API call, good Nepali quality. Requires `GROQ_API_KEY`.
2. **Google Translate** — paid, highest quality. Requires `GOOGLE_TRANSLATE_API_KEY`.
3. **LibreTranslate** — free self-hosted or public endpoints. Requires `LIBRETRANSLATE_API_URL`.
4. **MyMemory** — free fallback, rate-limited. No key needed (set `MYMEMORY_EMAIL` for higher quota).

If all providers are unavailable, items show English summaries in Nepali mode.

**Typography:** Both `Inter` (Latin) and `Noto Sans Devanagari` are loaded via `next/font/google`. The `font-np` CSS utility class applies the Devanagari font stack. It is used automatically in NewsCard and NewsCard brief sheet when rendering Nepali content.

---

## Environment Variables

| Variable                   | Required    | Default                     | Purpose                               |
| -------------------------- | ----------- | --------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`     | Production  | `https://www.ekjhalak.news` | Metadata, sitemap, OG tags            |
| `GROQ_API_KEY`             | Recommended | —                           | EN→NP translation + summarization     |
| `GROQ_MODEL`               | No          | `llama-3.3-70b-versatile`   | Groq model override                   |
| `GOOGLE_TRANSLATE_API_KEY` | No          | —                           | Translation fallback                  |
| `LIBRETRANSLATE_API_URL`   | No          | —                           | LibreTranslate endpoint               |
| `LIBRETRANSLATE_API_KEY`   | No          | —                           | LibreTranslate auth (if required)     |
| `MYMEMORY_EMAIL`           | No          | —                           | Last-resort free translation fallback |
| `REVALIDATE_SECRET`        | Production  | —                           | Protects POST /api/revalidate         |

See `.env.example` for full documentation.

---

## Theming

Two themes: **Night Ink** (dark, default) and **Clean Slate** (light). Preference stored in `localStorage` under key `cfn-theme`.

A blocking inline script in `<head>` sets `data-cfn-theme` on the root element before first paint — `ThemeProvider` reads this attribute as the initial state, preventing a flash of the wrong theme on load.

The Nepali script uses `Noto Sans Devanagari` loaded via `next/font/google`. Apply with the `.font-np` utility class.

---

## Production Notes

- **Cold start:** First request after a deploy triggers parallel fetching of all active sources (~3–5s). Subsequent requests within 10 minutes are cache hits.
- **Image optimization:** `next/image` is configured with `remotePatterns` for all active source domains. Unknown image hosts fall back gracefully (no image shown).
- **Error isolation:** A source that times out, returns HTTP 4xx/5xx, or emits malformed XML produces a `SourceStatusMeta` with `ok: false`. The rest of the feed is unaffected.
- **Cache invalidation:** To force an immediate refresh (e.g. after adding a source), delete `.next/cache` and restart the server, or call `revalidateTag("news-feed")` from a protected admin route.
- **Reuters:** Blocked from server-side fetches on shared-IP hosting (Vercel, Render, etc.). Re-enable with a dedicated egress IP or a proxy.

---

## Database Setup (Optional)

By default the app runs entirely in-memory (no database needed). To enable persistent articles, translation queuing, and the subscribe feature:

1. Create a [Supabase](https://supabase.com) project.
2. Run the migration in the SQL editor:

   ```sql
   -- paste contents of supabase/migrations/001_initial.sql
   ```

3. Seed sources:

   ```sql
   -- paste contents of supabase/seed/sources.sql
   ```

4. Set `DATABASE_URL` to the **Transaction Pooler** URL (port `6543`) in your environment.

---

## Admin API

Admin endpoints are protected by HMAC-SHA256. Set `INGEST_HMAC_SECRET`, then sign requests:

```bash
SECRET="your-secret"
BODY='{"trigger":"manual"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')
curl -X POST https://www.ekjhalak.news/api/admin/ingest/run \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$BODY"
```

| Endpoint                      | Description                                  |
| ----------------------------- | -------------------------------------------- |
| `POST /api/admin/ingest/run`  | Trigger a manual ingest run                  |
| `POST /api/admin/enrich/pump` | Process the translation queue                |
| `GET /api/status`             | Health check (DB, last ingest, queue depth)  |
| `GET /api/feed`               | Canonical public feed (replaces `/api/news`) |
| `GET /api/story/[id]`         | Single article by UUID                       |
| `GET /api/sources`            | Source list with live status                 |

---

## CI/CD

GitHub Actions runs lint → type-check → build on every push to `main`:

```
.github/workflows/ci.yml
```
