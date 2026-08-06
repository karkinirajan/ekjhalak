# एक झलक — Nepal & World News

Nepali news consumption has quietly become exhausting. Facebook timelines bury serious reporting under reactions and reposts. TikTok delivers clips stripped of context. WhatsApp groups circulate screenshots of screenshots — with no source, no date, no accountability. By the time a story reaches you, it has been amplified, clipped, and stripped of everything that made it verifiable. The noise is relentless. The signal is thin.

Ek Jhalak (एक झलक — "a single glance") was built as an antidote to that. It pulls from a curated set of trusted Nepali and international publishers — Kathmandu Post, Setopati, BBC, The Guardian, Al Jazeera, and more — and presents everything in one clean, chronological, ad-free interface. No algorithmic ranking. No engagement bait. No infinite scroll. Just the news, directly from the source, in the order it happened.

It is bilingual by design. Native Nepali content from Setopati, Ratopati, and Nagarik News is shown in Devanagari. English-language stories are readable in English or translated to Nepali on demand. The interface adapts cleanly to both scripts. The goal is one reliable place where you can actually read the news — fast, honest, and clutter-free.

Live: [ekjhalak.news](https://ekjhalak.news)

**Project state:** [`dev.md`](dev.md) tracks the eleven-phase hardening plan and
what each verification gate returned. [`development.md`](development.md) is the
remaining work, ordered by what unblocks the most.

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
  │  getCachedFeed()  [unstable_cache, 5-min TTL, tag: "news-feed"]
  ▼
lib/aggregator.ts  — parallel ingestion
  │  Promise.allSettled over all active sources
  │  per-source errors isolated — one bad source does not affect others
  ▼
lib/rss-adapter.ts  — fetch + parse
  │  AbortController (10s per source, clamped to the pass deadline)
  │  next: { revalidate: 300 }  [Next.js Data Cache, per-URL]
  │  fast-xml-parser  (RSS 2.0, Atom 1.0, RDF/RSS 1.0)
  ▼
lib/feed-normalizer.ts  — raw → NewsItem
  │  URL fingerprint (SHA-256, first 12 hex chars)
  │  tracking param stripping (utm_*, fbclid, gclid, …)
  │  timestamp capped at Date.now() (rejects future-dated items)
  ▼
lib/deduplicator.ts  — two-pass dedup
  │  Pass 1: exact URL fingerprint match
  │  Pass 2: Jaccard title similarity ≥ 0.45 within 2-hour window
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

On-demand invalidation: `POST /api/revalidate` calls `revalidateTag("news-feed", "max")` to bust the tag across all cache layers.

**Production runs on Netlify**, not Vercel — the site builds from `github.com/karkinirajan/ekjhalak` on `main` via `@netlify/plugin-nextjs`, and `ekjhalak.news` resolves there. That matters for anything platform-shaped:

- The daily cache-bust is `netlify/functions/revalidate-feed.mts`, a scheduled function that POSTs to `/api/revalidate` at 00:00 UTC — 05:45 in Kathmandu, just before the country wakes up to the stories filed overnight. Its schedule is declared in the function file rather than in `netlify.toml`, because the site's build settings live in the Netlify UI and introducing a `netlify.toml` would silently take those over too.
- `vercel.json` still declares the same job as a Vercel Cron. Netlify does not read that file, so that entry has never run; it is kept only so a Vercel deploy would still be scheduled. **`vercel.json` is not what runs in production.**
- Environment variables are set on the Netlify site, not in Vercel. A `.vercel/` directory in a working copy is a stale link and does not affect the deploy.

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

**Pass 1 — URL fingerprint:** SHA-256 of the canonical URL (tracking params stripped), first 12 hex chars as `id`. Exact collisions are dropped and nothing is recorded about them: an identical URL means the same outlet ran the same page twice, which is not co-coverage.

**Pass 2 — Title similarity:** For each surviving item, compare against all already-kept items published within a 2-hour window. Tokenize titles (lowercase, strip punctuation, 3+ character words, Unicode-aware so Devanagari survives), compute Jaccard similarity. At **≥ 0.45** the candidate is a duplicate and is dropped, and the survivor records both `coverageCount` — how many distinct outlets carried the story — and `alternateSourceIds[]` — which ones.

The threshold is 0.45 rather than something stricter for a measured reason: across every cross-source pair inside the 2-hour window in a live 475-story feed, the closest two real headlines scored 0.50. At 0.65 nothing ever merged and `coverageCount` was 1 on every story ever served. Different newsrooms rewrite headlines from scratch and agree on the proper nouns and little else.

**UI surface:** `coverageCount` drives the trending rail's ranking and the "N outlets covering" badge. `alternateSourceIds` is currently server-side only — stripped in `lib/feed-payload.ts`, written to the archive, and not yet shown to readers. It is captured inside `deduplicate` because that is the only moment it exists; the duplicate rows are discarded immediately afterwards.

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
# Set GEMINI_API_KEY to enable summarization and translation

# Run dev server
npm run dev
# → http://localhost:3000

# Check source health
curl http://localhost:3000/api/sources | jq '.sources[] | {name, active, status}'

# Check news feed
curl 'http://localhost:3000/api/news?range=day' | jq '{total: (.items | length), sources: [.meta.sourceStatuses[] | {name, ok, itemCount}]}'
```

**No environment variables required** for local development. The aggregator fetches public RSS feeds directly. Without `GEMINI_API_KEY` the enrichment pass is skipped entirely: summaries fall back to a deterministic truncation of the publisher's own body text, and every story renders in the language it was published in whichever language mode the reader picks.

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

On-demand cache invalidation. Busts the `"news-feed"` tag immediately — next request triggers a fresh aggregation. Called nightly by the Netlify scheduled function in `netlify/functions/revalidate-feed.mts`.

Both verbs fail closed: `GET` expects `Authorization: Bearer $CRON_SECRET`, `POST` expects `?secret=$REVALIDATE_SECRET`, and a missing secret is a 401 in production rather than an open cache-purge endpoint.

Set `REVALIDATE_SECRET` on the Netlify site (Site configuration → Environment variables). Without it the route returns 401 in production rather than accepting anyone; it is open in dev/staging.

---

## Nepali Language Support

Every story is held twice. `title`/`summary` are always the language the newsroom published in; `titleTranslated`/`summaryTranslated` are always the other one. `storyText()` in `lib/story-text.ts` picks the pair to render and falls back to the original whenever a translation is missing, so a story the enrichment pass has not reached yet still renders — in its source language, typeset correctly, rather than blank.

**Body text** comes from the feed's own `<description>` where there is one, and from the article's page where the feed's is thinner. `lib/article-extractor.ts` reads JSON-LD `articleBody`, then `og:description`, then the article's paragraphs, and the longest of feed-or-page wins. Structured metadata is preferred over paragraph scraping even when shorter — several CMSes render their whole section menu inside `<p>`, so joining paragraphs on those sites returns a site map rather than a story.

Anything still empty after that is **dropped**. A headline with no body under it is the one card this site should not render: it tells a reader something happened and refuses to say what. Per-source coverage is reported as `itemsWithText` on each `sourceStatus`, so an outlet that goes headline-only is visible rather than looking like it went quiet.

**Enrichment** runs inside the `unstable_cache` boundary in `lib/aggregator.ts`, so it happens once per 5-minute window rather than per request. One Gemini call carries a batch of ten stories and returns both languages as structured JSON: a summary in the source language plus a translated headline and summary.

Text that is already the right length is **not rewritten**. When a newsroom's own words arrive between `SUMMARY_MIN_CHARS` and `VERBATIM_MAX_CHARS`, they are shown as they stand and the model is asked only for the translation — a rewrite of prose that is already the right size can only lose a fact, and it would spend a request from a metered daily quota to do it. On a live sample that is 51 of the top 60 stories, so it is the common path, not the exception.

Two things shape the design, both of them quota:

- The free tier meters `GenerateRequestsPerDay` **per model** — measured at 20/day for `gemini-3.6-flash`, and 0/day for `gemini-2.0-flash`, on a fresh key. `lib/summarizer.ts` therefore walks a chain of five models, shelving each one when it 429s, which turns one allowance into five.
- `lib/enrichment-cache.ts` remembers what the model has already written for as long as the process lives. Without it, 288 regenerations a day would re-translate the same stories and exhaust the allowance before breakfast. With it, each pass spends its budget on stories nobody has seen yet, best stories first — so a cold feed converges on fully enriched over a morning instead of thrashing.

A translation that comes back in the wrong script is discarded rather than shown. Headlines are never rewritten: the card carries the publisher's own headline unless it is being translated.

**Typography:** `Space Grotesk` (Latin display), `Merriweather` (Latin body) and `Mukta` (Devanagari) are loaded via `next/font/google`. Mukta is the face `ekantipur.com` sets its own body text in. The `.font-np` utility applies the Devanagari stack and is used automatically wherever Nepali is rendered.

---

## Environment Variables

| Variable                   | Required    | Default                     | Purpose                               |
| -------------------------- | ----------- | --------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | No          | `https://ekjhalak.news`     | Metadata, sitemap, OG tags; apex, not www    |
| `GEMINI_API_KEY`       | Recommended | —                           | Summarization + translation                  |
| `GEMINI_MODEL`         | No          | built-in 5-model chain      | Pins a model, or a comma-separated list      |
| `GEMINI_BATCH_SIZE`    | No          | `10`                        | Stories per request (1–40)                   |
| `GEMINI_CONCURRENCY`   | No          | `3`                         | Requests in flight at once (1–8)             |
| `AGGREGATE_BUDGET_MS`  | No          | `15000`                     | Ceiling on one whole regeneration            |
| `GEMINI_BUDGET_MS`     | No          | `25000`                     | Cap on the model pass, within the above      |
| `EXTRACT_BUDGET_MS`    | No          | `15000`                     | Cap on the article-page pass, within the above |
| `SUPABASE_URL`         | No          | —                           | Archive; unset disables it entirely          |
| `SUPABASE_SERVICE_ROLE_KEY` | No     | —                           | Server-only secret; bypasses RLS             |
| `REVALIDATE_SECRET`    | Production  | —                           | Protects POST /api/revalidate                |
| `NEWSLETTER_SECRET`    | For opt-in  | —                           | Signs confirmation links (16+ chars)         |
| `RESEND_API_KEY`       | For email   | —                           | Set by the Resend Marketplace integration    |
| `NEWSLETTER_FROM`      | No          | `brief@ekjhalak.news`       | From address; domain must be Resend-verified |
| `RESEND_AUDIENCE_ID`   | No          | found/created by name       | Pins a specific Resend audience              |
| `NEWSLETTER_WEBHOOK_URL` | No        | —                           | Fallback list endpoint (single opt-in)       |

See `.env.example` for full documentation.

---

## Theming

Two themes: **Night Ink** (dark, default) and **Clean Slate** (light). Preference stored in `localStorage` under key `cfn-theme`.

A blocking inline script in `<head>` sets `data-cfn-theme` on the root element before first paint — `ThemeProvider` reads this attribute as the initial state, preventing a flash of the wrong theme on load.

The Nepali script uses `Mukta` — the face Kantipur uses — loaded via `next/font/google`. Apply with the `.font-np` utility class.

Corners are a flat, near-square scale: `--radius` is 6px and the derived `--radius-sm` … `--radius-3xl` steps run 4px to 14px as absolute values rather than multiples. Anything that must be a circle asks for `rounded-full`, which the scale does not touch.

---

## Production Notes

- **Cold start:** The feed cache revalidates every 5 minutes and Next.js resolves that on the request path, so whichever reader arrives first after it goes stale pays for the whole regeneration — RSS, article extraction and the model pass. `AGGREGATE_BUDGET_MS` (15s) bounds that so it cannot cross Netlify's 30-second request limit; measured at 15.0s cold, 0.01s warm. Every network call inside the pass clamps its own timeout to the time remaining, which is what makes the bound hold.
- **Archive:** When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, each regeneration upserts its stories into `public.articles` — schema in `supabase/migrations/20260806000000_articles.sql`. Nothing on the request path reads it; the feed is still built from RSS, and the site behaves identically with it unset. The write takes a 3-second reserve out of the model stage rather than adding to the pass, so `AGGREGATE_BUDGET_MS` stays the ceiling. `first_seen_at` is set on insert and deliberately never sent on update — it is the one timestamp here that cannot be recovered from anywhere else.
- **Image optimization:** `next/image` is configured with `remotePatterns` for all active source domains. Unknown image hosts fall back gracefully (no image shown). Note that the lead card currently paints a raw publisher URL rather than a `next/image` — measured at 2.4 MB for a 378×236 slot, and the single largest cost on the page. See `audit/baseline/summary.md`.
- **Error isolation:** A source that times out, returns HTTP 4xx/5xx, or emits malformed XML produces a `SourceStatusMeta` with `ok: false`. The rest of the feed is unaffected.
- **Cache invalidation:** To force an immediate refresh (e.g. after adding a source), delete `.next/cache` and restart the server, or call `revalidateTag("news-feed")` from a protected admin route.
- **Reuters:** Blocked from server-side fetches on shared-IP hosting (Vercel, Render, etc.). Re-enable with a dedicated egress IP or a proxy.

---

## Database Setup (Optional)

The app runs entirely without a database and is deployed that way today. The
archive below is additive: unset the two variables and the site behaves exactly
as it did before the table existed.

1. Create a [Supabase](https://supabase.com) project.
2. Apply `supabase/migrations/20260806000000_articles.sql` — one table,
   `public.articles`, with RLS enabled and no policies (a deliberate deny-all;
   the writer uses the service role, which bypasses RLS, and nothing in the
   browser reads it).
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is a
   server-only secret — never prefix it with `NEXT_PUBLIC_`.

There is no `DATABASE_URL`, no connection pooler and no `supabase/seed/`. Writes
go over PostgREST with `fetch`, so there is no client library, no connection
lifecycle, and no dependency added. Sources live in `lib/source-registry.ts`, in
code, where they are reviewed like everything else.

---

## SaaS Layer

### Story pages — `/story/[id]`

Every story has an indexable, shareable permalink. `id` is the SHA-256
fingerprint of the normalised article URL — the same identity the rest of the
pipeline already means by "this story", not a second scheme.

- **Resolution** goes through `lib/story-lookup.ts`, which is deliberately the
  only seam. It reads the live cached feed today; when the archive is
  provisioned, that one function changes and the pages do not.
- **A permalink is currently only valid while its story is inside the
  aggregation window.** Once a story ages out it 404s. That is exactly the
  fragility the `articles` table exists to remove.
- **404s are real 404s.** The loading UI sits at `app/(feed)/loading.tsx`, inside
  a route group rather than at `app/` root, and that placement is load-bearing:
  a `loading.tsx` wraps its segment in Suspense, Next.js flushes
  that shell as HTTP 200 before the page renders, and `notFound()` underneath it
  then produces the not-found UI under a 200 — a soft 404 that tells Google an
  expired permalink is a live page. Measured: 200 with the file at `app/` root,
  404 without. **Do not move it back.**
- The page renders in the language the newsroom filed in, with `lang` on every
  text node and the translation offered beneath it in its own.

### The display cap — read this before changing it

`lib/story-excerpt.ts` caps **every reader-facing surface** at 400 characters:
page body, reading panel, `og:description`, `twitter:description` and the JSON-LD
`description`. It breaks on a sentence boundary where one exists, including the
Devanagari danda.

**It is a copyright posture, not a design preference.** `lib/article-extractor.ts`
deliberately keeps whichever is *longer* of the feed description and the article
page's own body, because the model summarises better from more material — so this
codebase sometimes holds something close to a full article. Holding it is fine.
Rendering it is not, once pages are permalinked, indexed, and attached to a
product. That is the exact fact pattern publishers litigate, and NYT, the
Guardian and CNN are all in the active source list.

Verified on the longest story in a live feed: **2,638 characters held, 392
rendered.** Eight tests cover the module, one of which exists purely to fail if
the cap is removed. A future contributor "helpfully" raising the number is
trading a legal position for screen real estate on a page whose entire job is to
send the reader to the publisher.

The outbound **"Read the full story at {sourceName} →"** is a primary button
directly beneath the headline, above both the excerpt and the image. It is not
decoration and it does not belong in a footer.

### Structured data

`NewsArticle` JSON-LD per story page. `author` is the **originating newsroom**;
EkJhalak is only `publisher`; `isBasedOn` points at the source article. That is
both the accurate claim and the one that makes the schema safe to publish — it
says in machine-readable form that someone else wrote this and we are pointing
at it.

### Sitemaps

| Route | What it carries |
| --- | --- |
| `/sitemap.xml` | Static pages plus every story currently reachable (465 URLs; it was 6) |
| `/news-sitemap.xml` | Google News extension — `news:publication`, `news:language`, `news:publication_date`, `news:title`; last 48 hours; capped at Google's 1,000 |

`robots.txt` lists both. All `<loc>` values use the apex, `ekjhalak.news` —
`www.` 301s to it, and publishing canonical URLs on a host you redirect away from
is what `lib/site-url.ts` exists to prevent. That module is the single place the
site's address is written down.

### Verification gates

The audit trail lives in `/audit`: `recon.md`, `baseline/`, `post-perf/`,
`final/`. Each phase's gate is a command, not a claim.

| Command | Checks |
| --- | --- |
| `pnpm verify` | lint → typecheck → 52 tests → contrast → build |
| `pnpm check:feed [url]` | 19 checks on a live feed: markup and entity leakage, image coverage, summary lengths, the display cap, required fields, duplicate ids |
| `pnpm check:seo [url]` | sitemaps, canonical host, `NewsArticle` completeness, real 404 on an expired permalink |
| `pnpm check:a11y <url>` | axe-core over the hydrated page; exits non-zero on critical/serious |
| `pnpm check:contrast` | WCAG AA on the authored token pairs |
| `pnpm verify:live` | feed → a11y → SEO, in that order, against production |

`check:contrast` and `check:a11y` are not redundant. The first reads token pairs
as authored and cannot see a ratio broken at render time by an `opacity-*`
utility; the second scans what the browser actually painted. That gap was a real
six-node violation.

### Server/client boundary

Seven modules import `"server-only"` — the aggregator, summarizer, extractor, RSS
adapter, article store, newsletter and story lookup. Importing any of them from a
client component is a build error rather than a bundle that ships secret-reading
code and model prompts to browsers.

### Not built, deliberately

- **No programmatic display ads.** They contradict the product's own identity and
  its only real differentiation from every other Nepali aggregator.
- **No `netlify.toml`.** The build config lives in the Netlify UI and a toml would
  silently take it over. See the Netlify note under *Caching & Revalidation*.
- **Auth, personalization and billing** are specified but unbuilt — both depend on
  the archive being provisioned. See `dev.md`.

---

## Admin API

**There is none.** Earlier revisions of this README documented
`POST /api/admin/ingest/run`, `POST /api/admin/enrich/pump`, `GET /api/status`,
`GET /api/feed`, `GET /api/story/[id]`, `GET /api/sources` and an
`INGEST_HMAC_SECRET` signing scheme. None of them were ever built —
`INGEST_HMAC_SECRET` appears nowhere in the source. The section is kept as this
note rather than deleted outright, because a contributor who read the old version
should find out it was fiction rather than conclude the endpoints were removed.

The real endpoints are in *API Endpoints* above. Cache invalidation is
`POST /api/revalidate?secret=…`, called nightly by
`netlify/functions/revalidate-feed.mts`.

---

## CI/CD

GitHub Actions runs lint → type-check → build on every push to `main`:

```
.github/workflows/ci.yml
```

---

## Next-Level Roadmap (10 Upgrades)

Status as of 2026-08-06. Items 3 and 10 shipped in part during the phased
hardening pass; see `dev.md` for what each phase's gate actually returned. The
rest stand as written — they are legitimate future work, not backlog filler.

1. Personal Briefing Profiles
Users pick topics, regions, and reading depth (`60s`, `3m`, `deep read`) so the homepage feels intentional per user instead of one-size-fits-all.

2. Morning/Evening Digest Delivery
Ship polished digests to email, Telegram, and WhatsApp at user-selected times with timezone awareness and skip logic for low-news days.

3. Trust Layer + Source Transparency — **partly shipped**
Every card shows its outlet and, where more than one newsroom carried the story,
an "N outlets covering" count computed in the dedup pass. `alternateSourceIds[]`
records *which* outlets, captured at the only moment that answer exists — it is
server-side today and is the raw material for the coverage-comparison view.
Still to do: diversity score, correction notes, direct-source badges.

4. Story Clusters + Live Timelines
Cluster related reports across sources into one evolving story timeline (first report, major updates, latest status).

5. Explain-It Module
For major events, add quick context cards: `What happened`, `Why it matters`, `What to watch next`, and `Known unknowns`.

6. Audio Briefings (Nepali + English)
Generate a short daily audio summary with clean voice options and chapter markers by topic.

7. Smart Alerts (High Signal Only)
Push notifications only for user-selected severity and categories to avoid alert fatigue and maintain trust.

8. Pro Research Mode
Power users get advanced search, date/source filters, quote extraction, and export to PDF/Markdown/CSV.

9. Publisher + Institution Dashboard
Offer a B2B dashboard for embassies, NGOs, media teams, and analysts with trend snapshots, media pulse, and briefing exports.

10. Performance + Reliability Hardening — **partly shipped**
`pnpm check:feed`, `check:seo`, `check:a11y` and `check:contrast` are the
synthetic checks; a source that returns no usable text is flagged per-source in
`/api/news` rather than silently vanishing. Mobile Lighthouse went 67 → 94 and
desktop 77 → 100, with total page weight 3,444 → 705 KiB. Still to do: uptime
SLOs, a dashboard, and automatic quarantine of a dead source.

---

## Monetization

See **[MONETIZATION.md](MONETIZATION.md)** — the plan, the pricing, the revenue
mix, the KPIs and the 30-day checklist, plus a dated changelog of what has
actually shipped against it.

It lives in its own file because it is a business document that changes on a
different clock from this one, and because a README that a contributor reads to
understand the code should not open onto a pricing table.
