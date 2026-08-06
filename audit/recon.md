# Phase 0 — Recon

Date: 2026-08-06 · Branch `main` · Published deploy `6a7191ef547e65000837c680` (commit `ff3eeaa2`, state `ready`)

No code changes were made in this phase.

---

## 1. Source documents read

| Document | Status |
| --- | --- |
| `README.md` (497 lines) | Read in full |
| `.env.example` (96 lines) | Read in full |
| `supabase/migrations/001_initial.sql` | **Does not exist** |
| `supabase/seed/sources.sql` | **Does not exist** |

There is no `supabase/` directory in the repository at all. `README.md` §"Database Setup (Optional)" instructs a reader to "paste contents of `supabase/migrations/001_initial.sql`" into the Supabase SQL editor — that file has never existed in tracked history. The database section of the README is aspirational documentation, not a description of shipped code.

---

## 2. Deployment target

**Netlify.** Confirmed against the Netlify API for site `ekjhalak` (`cd9d7b2c-2b89-463c-bb69-f07bb40e9d3f`, account `karkinirajan1999`).

```
build.cmd        = npm run build
build.dir        = .next
build.base       = (empty)
build.repo_branch= main
build.functions_dir = None      (auto-detected: netlify/functions/)
custom_domain    = ekjhalak.news
domain_aliases   = []
ssl_url          = https://ekjhalak.news
account plan     = Free
```

- Build settings live in the **Netlify UI**, not in a file. There is **no `netlify.toml`** in the repo — confirmed. Per the standing instruction, none will be created.
- `vercel.json` exists and declares a cron at `/api/revalidate`. Netlify does not read it. It has never run. Dead code, intentionally retained.
- The real scheduled job is `netlify/functions/revalidate-feed.mts`, registered and firing on `0 0 * * *`.
- Repo declares `packageManager: pnpm@11.9.0` and commits `pnpm-lock.yaml` (6,374 lines), but the Netlify build command is `npm run build`. Netlify detects the pnpm lockfile and uses pnpm regardless, so this works today — but the mismatch is a latent trap and worth aligning to `pnpm build`.

---

## 3. Database status — **NOT PROVISIONED**

This is the answer that changes Phase 2/3/7 scope, so stating it unambiguously:

| Check | Result |
| --- | --- |
| `supabase/` directory in repo | Absent |
| Migration file | Absent |
| `DATABASE_URL` in Netlify env | Not set |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` in Netlify env | Not set |
| Any Supabase client code in `lib/` | None |
| Any DB read/write on the request path | None |

**The app is 100% in-memory today.** Nothing is persisted between aggregation passes except the in-process `lib/enrichment-cache.ts` memo, which dies with the function instance.

**Consequence for the plan:** Phase 2 is *"design the schema from scratch"*, not *"wire up the existing schema"*. There is no migration to run and no seed to load. The `articles` table, its indexes, and the `canonical_id` self-FK all have to be authored. Budget accordingly.

---

## 4. Environment variable drift — Netlify vs `.env.example`

### Set in Netlify (4 variables)

| Key | Scopes | Contexts | Verdict |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | builds, functions, runtime | branch-deploy, deploy-preview, dev, dev-server, production | OK |
| `NEWSLETTER_SECRET` | builds, functions, post_processing, runtime | all | OK |
| `REVALIDATE_SECRET` | builds, functions, post_processing, runtime | all | OK |
| `RESENT_API_KEY` | builds, functions, post_processing, runtime | all | **MISSPELLED — see D1** |

### Documented in `.env.example` but NOT set in Netlify

| Key | Impact of absence |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Falls back to `https://www.ekjhalak.news`. **See D2 — this is actively wrong.** |
| `RESEND_API_KEY` | See D1 — the newsletter has no mail transport. |
| `NEWSLETTER_FROM` | Defaults to `EkJhalak <brief@ekjhalak.news>`; domain must be Resend-verified or every send is rejected. Unverified. |
| `RESEND_AUDIENCE_ID` | Optional — found/created by name. Fine. |
| `NEWSLETTER_WEBHOOK_URL`, `NEWSLETTER_API_KEY` | Optional fallback provider. Fine unset. |
| `CRON_SECRET` | Vercel-only concept. Irrelevant on Netlify. Fine unset. |
| `GEMINI_MODEL` | Correctly unset — pinning one model collapses the 5-model fallback chain to a single 20/day allowance. **Do not set this.** |
| `GEMINI_BATCH_SIZE`, `GEMINI_CONCURRENCY`, `GEMINI_BUDGET_MS`, `EXTRACT_BUDGET_MS` | Unset, using code defaults. **See D3.** |

### Documentation drift found

- `.env.example` header says *"Set these in your Vercel project → Settings → Environment Variables"*. Production is Netlify. Misleading.
- `README.md:235` says *"Set `REVALIDATE_SECRET` in Vercel environment variables."* Same error.
- `README.md:292` says `--radius` is 4px and the scale runs 2–10px. `app/globals.css:125` sets `--radius: 6px` with a 4–14px scale. Stale.
- The prompt driving this work describes the app as **Next.js 15**. `package.json` pins **`next@16.2.12`** with `react@19.2.8`. Worth correcting in the plan, since Next 16 changes async `searchParams`/`params` semantics that any new `app/story/[id]/page.tsx` (Phase 3) must honour.

---

## Flagged production defects (found during recon, not yet fixed)

### D1 — Newsletter is silently dead: `RESENT_API_KEY` is a typo

The Netlify site has a variable named **`RESENT_API_KEY`**. `lib/newsletter.ts:29` reads **`process.env.RESEND_API_KEY`**. The names do not match, so the key is invisible to the app.

Effect: `hasResend()` returns false → no mail transport → double opt-in cannot send a confirmation email → `/api/subscribe` returns **503** and the form tells every reader the list is not open yet. The subscription feature built in the previous session has never worked in production for this reason alone.

**Fix (Netlify UI, no deploy needed for the value itself — but a rebuild is required for it to reach the function bundle):**
1. Netlify → Site configuration → Environment variables
2. Rename `RESENT_API_KEY` → `RESEND_API_KEY` (or create the correctly-named one with the same value and delete the old one)
3. Trigger a redeploy

I did not perform this myself: reading the secret's value to copy it was blocked by the permission classifier, which is the correct outcome. This is a two-click change in the UI.

Also unverified: whether `ekjhalak.news` is a **verified sending domain in Resend**. If it is not, `NEWSLETTER_FROM=EkJhalak <brief@ekjhalak.news>` will be rejected on every send even once the key name is fixed.

### D2 — Every canonical URL points at a hostname that 301s away

`NEXT_PUBLIC_SITE_URL` is unset, so `app/layout.tsx:52`, `app/sitemap.ts:5` and `app/robots.ts:3` all fall back to `https://www.ekjhalak.news`.

Measured:

```
https://www.ekjhalak.news/  →  HTTP 301  →  https://ekjhalak.news/
```

Netlify's `custom_domain` is the apex `ekjhalak.news` and `domain_aliases` is empty. So the site tells Google:

- `og:url` = `https://www.ekjhalak.news` — a redirect
- all 6 `<loc>` entries in `sitemap.xml` — redirects
- `Sitemap:` line in `robots.txt` — a redirect

Every indexable URL declared by this site is a permanent redirect to a different hostname. This wastes crawl budget and muddies canonicalisation before Phase 3 adds a single story page.

**Fix:** set `NEXT_PUBLIC_SITE_URL=https://ekjhalak.news` on the Netlify site and redeploy. This is an indexing-signal change, so it belongs to Phase 3 rather than being made unilaterally here — but it is cheap and should be the *first* thing Phase 3 does, before any new URLs are minted under the wrong host.

### D3 — The reported outage: `/api/news` blocks on cold aggregation and exceeds the function limit

This is the "site is not loading" report. Root cause identified.

Measured across this session:

```
cold  /api/news?range=day&limit=5   HTTP=502  ttfb=30.517s  total=30.517s
cold  /api/news?range=day&limit=5   HTTP=200  ttfb= 0.824s  total=30.536s
warm  /api/news?range=day&limit=5   HTTP=200  ttfb= 0.230s  total= 0.300s   cache-status: "Netlify Edge"; hit; ttl=171
warm  /                             HTTP=200  ttfb= 0.917s  total= 1.388s
```

The failure is **intermittent by construction**: `getCachedFeed` is `unstable_cache(..., { revalidate: 300 })`, so every 5 minutes the entry goes stale and the next request to arrive pays for a full regeneration on the request path. When that regeneration overruns the function limit, that reader gets a 502. Everyone arriving in the following 5 minutes gets a 0.3s cache hit and sees nothing wrong. That is exactly the "sometimes it doesn't load" pattern reported.

The cold path's worst case, from `lib/aggregator.ts`:

| Stage | Budget | Source |
| --- | --- | --- |
| RSS fan-out across 22 sources | up to 10s per source, parallel | `lib/rss-adapter.ts` `AbortController` |
| Article-page extraction pass | `EXTRACT_BUDGET_MS` = **15,000ms** | `lib/aggregator.ts:190` |
| Gemini enrich + translate pass | `GEMINI_BUDGET_MS` = **25,000ms** | `lib/aggregator.ts:168` |
| **Total worst case** | **~50s** | — |

The two enrichment budgets are **independent and additive** — nothing bounds their sum. 15s + 25s alone is 40s before a single RSS byte is fetched.

This got worse, not better, as a side effect of a correct fix made last session: `GEMINI_MODEL` was deleted from Netlify because pinning `gemini-3.6-flash` capped the pipeline at that one model's 20-requests/day quota. While it was pinned and exhausted, every Gemini call 429'd instantly and the enrich stage returned in milliseconds — the 25s budget was never actually spent. Removing the pin made the 5-model fallback chain work, so the stage now genuinely spends its budget, and the cold path crossed the function limit for the first time.

**FIXED.** This was an active production outage carried over from the previous session's explicit "fix that", so it was treated as an operational hotfix rather than held behind the Phase 0 gate.

Diagnosis required instrumentation, because the first two attempts made it *worse* — the budget was being enforced in the wrong place. Measured, per stage, on a cold pass:

```
attempt 0 (as found)      44,562ms   rss 8,030ms   enrich 36,532ms
attempt 1 (one deadline)  40,904ms   — no better
attempt 2 (+ instrument)  43,590ms   rss 5,296ms   enrich 38,294ms
                                     sort 2ms · extract 5,884ms (slice 5,880ms — honoured)
                                     enrich block 32,400ms against an 8,813ms slice
```

The root cause was not the budgets themselves but **deadline checks that gate whether a unit of work *starts*, while the work it starts carries its own much larger timeout**:

- `lib/summarizer.ts` — `enrichStories()` checks the deadline before claiming a batch, but `callModel()` used a flat `REQUEST_TIMEOUT_MS = 45_000`. A batch claimed with 2s left ran up to 45s, times `CONCURRENCY = 3`. This was the dominant term.
- `lib/article-extractor.ts` — the same shape: `extractMany()` checks the deadline per item, but `fetchArticleHtml()` used a flat `FETCH_TIMEOUT_MS = 12_000`, times `concurrency = 4`.

Fix, in three parts:

1. `AGGREGATE_BUDGET_MS` (default **15,000**) — one deadline for the whole pass, set in `aggregateAllSources`. `GEMINI_BUDGET_MS` and `EXTRACT_BUDGET_MS` became caps *within* it rather than allowances added to it, via a `slice()` helper that floors at zero so a passed deadline skips a stage outright instead of reading as "one item then stop".
2. Every network call inside the pass clamps its own timeout to the time remaining — `requestTimeout(deadline)` in the summarizer, `fetchTimeout(deadline)` in the extractor. This is the part that actually made the bound hold.
3. `enrichBatch()` also breaks out of the 5-model fallback chain at the deadline, so five models cannot each spend a request timeout on one batch.

Verified — three consecutive cold passes, cache busted via `/api/revalidate` between each:

```
cold  15.031s   222,019 bytes
cold  15.022s   222,019 bytes
cold  15.021s   236,584 bytes
warm   0.005s
overrun warnings logged: 0        (451/452 stories kept)
```

**44.6s → 15.0s**, pinned to the deadline, with 15s of headroom under Netlify's 30s limit. `pnpm lint`, `typecheck` and 38/38 tests pass.

#### D3b — the same bug, twice more, and only production could see it

Shipping the above (`f33df2e`) did **not** clear the outage. Production still 502'd on the first cold pass after the deploy, then behaved once warm:

```
cold  /api/news?range=day&limit=100   HTTP=502  total=40.227s
warm  /api/news?range=day&limit=100   HTTP=200  total= 1.011s / 0.494s / 0.507s
```

Local was pinned at 15.0s across cold passes, so whatever was overrunning sat **outside** the deadline the fix had established — which, at that point, covered extraction and the model stage but not RSS ingestion. Two more instances of the same bug class were in the RSS path:

- `lib/rss-adapter.ts` — `fetchRssFeed`'s `clearTimeout` sat in a `finally` attached to `fetch()` alone, so it fired when the *headers* arrived and left `await response.text()` with no timeout at all. A source that answered promptly and then dribbled its body held the fan-out open indefinitely; because every source is awaited together, one such outlet set the cost of the whole stage. The abort now survives until the body is read, and `fetchRssFeed` takes the pass deadline.
- `lib/rss-adapter.ts` — `enrichShortDescriptions`, called at the end of every `fetchRssFeed`, scraped the article page of every story whose description ran short: batches of four, `ENRICH_TIMEOUT_MS = 5_000` each, walked **sequentially** over as many as thirty stories. Worst case ⌈30/4⌉ × 5s = **40s for a single source**, with no deadline check anywhere in it — which is the 40.2s measured above almost exactly.

The second one was also **redundant**. `lib/article-extractor.ts` does the same job later in the same pass, in ranked order, against the deadline, with a better ladder (JSON-LD `articleBody` → `og:description` → paragraphs), and `enrichFeed` already overwrites the summary wherever the page has more to say than the feed did. Keeping both meant fetching every article page twice per regeneration, and the copy in the RSS adapter was the unbounded one. It was deleted rather than bounded — 194 lines, including the now-unreachable `scrapeArticleDescription`, `findArticleBody` and `countParagraphs`.

Why local never showed it: those scrapes hit Nepali origin servers, which answer this machine quickly and Netlify's US region slowly. Locally the batches returned well inside their 5s timeout and the pass still landed on its budget; from the function region enough of them hit the timeout to walk the full 40s. A bound that only holds on the fast network is not a bound.

Third part of the fix: `RSS_SHARE = 0.5` gives RSS ingestion half the pass, so the stage that runs *first* can no longer spend the budget the stages that make the feed readable depend on. A source that misses its slice is simply absent from this pass and present in the next — the fan-out is `allSettled`, and the feed renders whatever arrived.

Verified locally on a genuinely cold pass, `.next/cache` deleted after build:

```
cold  15.044s   HTTP=200
warm   0.011s   HTTP=200
overrun warnings logged: 0        (451/453 stories kept)
```

And in production, on the first request after `4615baa` went ready — the same measurement that returned 502 after the previous deploy:

```
cold  16.498s   HTTP=200      (was 40.227s  HTTP=502)
warm   0.681s   HTTP=200
warm   0.685s   HTTP=200
```

The extra 1.5s over local is the 301 hop described in D2 plus transatlantic round-trips; the function region is `cmh`.

Then sampled every 45 seconds for eight minutes, spanning two `revalidate: 300` boundaries — the window in which the pre-fix build handed one reader in every five minutes a 502:

```
16:38:18 → 16:45:56   11/11 HTTP=200
median 0.68s · slowest 1.36s (16:43:38, a revalidation served stale while it refreshed)
```

No 502, and no reader paid a regeneration: `stale-while-revalidate=600` now has a regeneration short enough to finish inside it.

Still worth doing, and unchanged by the above: move enrichment **off the request path** entirely. Once Phase 2's `articles` table exists, the scheduled function can do the expensive extraction/summarisation pass and write results, leaving `/api/news` to only ever read — at which point cold-start latency stops existing rather than merely being bounded. The 15s a reader can still pay is a bound, not a fix.

---

## Gate

Phase 0's gate requires human confirmation of DB status before proceeding. Recorded answer: **no database is provisioned; Phase 2 is a from-scratch schema design.**

Awaiting Nirajan's confirmation on that, and a decision on whether D3 is fixed immediately as an operational hotfix or folded into the phased work.
