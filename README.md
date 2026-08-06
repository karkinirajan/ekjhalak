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
| `NEXT_PUBLIC_SITE_URL` | Production  | `https://www.ekjhalak.news` | Metadata, sitemap, OG tags                   |
| `GEMINI_API_KEY`       | Recommended | —                           | Summarization + translation                  |
| `GEMINI_MODEL`         | No          | built-in 5-model chain      | Pins a model, or a comma-separated list      |
| `GEMINI_BATCH_SIZE`    | No          | `10`                        | Stories per request (1–40)                   |
| `GEMINI_CONCURRENCY`   | No          | `3`                         | Requests in flight at once (1–8)             |
| `AGGREGATE_BUDGET_MS`  | No          | `15000`                     | Ceiling on one whole regeneration            |
| `GEMINI_BUDGET_MS`     | No          | `25000`                     | Cap on the model pass, within the above      |
| `EXTRACT_BUDGET_MS`    | No          | `15000`                     | Cap on the article-page pass, within the above |
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

---

## Next-Level Roadmap (10 Upgrades)

1. Personal Briefing Profiles
Users pick topics, regions, and reading depth (`60s`, `3m`, `deep read`) so the homepage feels intentional per user instead of one-size-fits-all.

2. Morning/Evening Digest Delivery
Ship polished digests to email, Telegram, and WhatsApp at user-selected times with timezone awareness and skip logic for low-news days.

3. Trust Layer + Source Transparency
Add visible source signals: source diversity score, first-published timestamp, correction notes, and direct-source prominence badges.

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

10. Performance + Reliability Hardening
Add uptime SLOs, feed quality dashboards, dead-source auto-quarantine, and synthetic checks for critical routes.

---

## Monetization Guide (Step-by-Step)

### Phase 1: Validate Demand (Weeks 1–3)

1. Define your paid value proposition
`Save 30–60 minutes/day with clean, verified Nepal + world briefings.`

2. Add a waitlist and interest capture
Collect intent by user type: student, journalist, policy, business, diaspora.

3. Run 20 short user interviews
Focus on willingness-to-pay, not just feature requests.

4. Pick one paid wedge
Choose one entry product first: `Pro Alerts` or `Morning Digest Pro`.

### Phase 2: Launch Revenue v1 (Weeks 4–8)

1. Introduce 3 tiers
`Free`: core feed
`Pro Individual`: personalization, alerts, advanced filters
`Pro Team`: shared dashboards, exports, scheduled reports

2. Suggested starter pricing
`Pro Individual`: $4.99–$7.99/month
`Pro Team`: $29–$99/month depending on seats and report limits

3. Add paywall boundaries
Keep public trust features open; gate convenience and productivity features.

4. Add Stripe checkout + billing portal
Support monthly and annual plans (`2 months free` on annual).

### Phase 3: Strengthen Retention (Months 3–4)

1. Build habit loops
Daily digest streaks, weekly recap, and save/read-later collections.

2. Add usage-based nudges
If user misses 3 days, send a lighter digest. If user is highly active, upsell Pro Team.

3. Track activation metric
Target: user reads at least 5 stories across 3 days in week 1.

4. Reduce churn with exit-intent offers
Offer pause plan, lower tier, or topic-only subscription before cancellation.

### Phase 4: Expand B2B (Months 5+)

1. Package institutional plans
Policy desks, PR teams, NGOs, and research organizations.

2. Add branded weekly intelligence reports
White-label PDF/email reports with custom topic packs.

3. Offer annual contracts
Discount annual prepay to improve cash flow and retention.

4. Build partner channels
University journalism programs, think tanks, and diaspora associations.

---

## Recommended Revenue Mix

1. Subscriptions (primary)
Individual and team recurring plans should drive most revenue.

2. B2B intelligence reports (high margin)
Recurring institutional briefings with SLA-backed delivery.

3. Ethical sponsorships (secondary)
Limited, clearly labeled sponsorship placements in digest emails only.

4. Affiliate referrals (selective)
Only for relevant tools and services with strict quality standards.

---

## KPIs to Track Weekly

1. Visitor → signup conversion
2. Signup → activated user conversion
3. Activated user → paid conversion
4. Monthly churn rate
5. ARPU (average revenue per user)
6. LTV/CAC ratio
7. Digest open and click-through rates
8. Retention at day 7, 30, and 90

---

## 30-Day Execution Checklist

1. Add waitlist + pricing page
2. Implement auth + Stripe billing
3. Launch one premium feature (`Pro Digest` recommended)
4. Add product analytics events (activation funnel)
5. Run first 10 paid user pilots
6. Publish one institutional plan page
7. Ship weekly product update notes
8. Review KPI dashboard every Monday
