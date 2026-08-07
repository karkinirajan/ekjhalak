# EkJhalak — Phased Execution Plan

Working tracker for the solo-builder SaaS transformation. Each phase has a hard
verification gate; a phase is not "done" because its code merged, it is done when
its gate command returns the required result.

**Final audit: 2026-08-06, against production deploy `ca9b65b`.** Seven of eleven
phases done, two blocked on one decision, two partial for reasons recorded below.

**What is left lives in [development.md](development.md)** — this file records
what each gate returned, that one records the remaining work and why.

Status legend: **done** · **partial** · **blocked** · **not started**

| # | Phase | Status | Gate met |
| --- | --- | --- | --- |
| 0 | Recon | **done** | yes |
| 1 | Automated audit baseline | **done** | yes |
| 2 | Content persistence layer | **partial** — project exists, 2 setup steps left | no — see development.md §1 |
| 3 | Story pages + SEO remediation | **done** | yes |
| 4 | Performance remediation | **partial** | CLS yes, LCP target no |
| 5 | Accessibility remediation | **done** | yes |
| 6 | Best practices remediation | **done** | yes |
| 7 | Auth + personalization | **blocked** on Phase 2 | — |
| 8 | Monetization infrastructure | **blocked** on Phase 7 | — |
| 9 | Full re-verification | **done** | yes — no regressions |
| 10 | Documentation | **done** | yes |
| 11 | Bilingual verify-then-publish | **partial** — audit shipped, queue blocked | see development.md §1b |
| 12 | Category colour system | **done** | yes — 62 contrast + 110 distinctness pairs |  

---

## Standing constraints

These override convenience at every phase.

- **Netlify, not Vercel.** `vercel.json` is dead code kept only so a Vercel deploy
  would still schedule its cron. The real scheduled job is
  `netlify/functions/revalidate-feed.mts`; the real build config lives in the
  Netlify UI. **Do not create a `netlify.toml`** — it silently takes over the
  build settings the UI currently controls. If Netlify config is genuinely needed,
  extend via CLI/UI or a `[functions]`-only toml, and confirm before merging.
- **Preserve, do not rebuild:** `lib/aggregator.ts`, `lib/rss-adapter.ts`,
  `lib/feed-normalizer.ts`, `lib/deduplicator.ts`, `lib/source-registry.ts`,
  `lib/story-text.ts`, `lib/article-extractor.ts`, `lib/summarizer.ts`,
  `lib/enrichment-cache.ts`, `app/api/news/route.ts`.
- **No** Kubernetes, Kafka, microservices, multi-tenant white-label layer, or any
  team-of-15 assumption. One person operates this.
- **No programmatic display ads.** They contradict the product's stated identity
  ("no clutter, no noise") and its only real differentiation from every other
  Nepali aggregator. Monetize the reading experience and the digest, not the page
  furniture.
- **Display cap is mandatory and load-bearing.** `lib/article-extractor.ts` prefers
  the *longest* of feed-description vs page-extraction, so it sometimes holds
  near-full article bodies. Fine for a private ad-free aggregator leaning on
  "snippet + link". Not fine for a paid product with permalinked reader-facing
  pages — that is the exact fact pattern NYT, Guardian and CNN litigate, and all
  three are in the active source list. The extractor may keep full text as model
  input; **nothing beyond a bounded excerpt may ever render or be indexed.**

---

## Phase 0 — Recon — **done**

Read the source docs, confirm the deploy target, confirm whether a database
exists.

**Gate:** `audit/recon.md` exists covering all four points, and a human confirms
the DB status. **Met** — no database was provisioned, confirmed by the operator,
so Phase 2 became a from-scratch schema design rather than a wiring job.

Also found and fixed three production defects, recorded as D1–D3 in that file.
D3 was the live outage: `/api/news` overran Netlify's 30-second limit and returned
502 to one reader every five minutes. Four instances of one bug — a deadline check
gating whether work *starts* while the work it starts carries its own much larger
timeout. Fixed across `summarizer.ts`, `article-extractor.ts`, `rss-adapter.ts`
and `aggregator.ts`; production went from `502 @ 40.2s` to `200 @ 16.5s` cold.

**D1 — partly closed.** The production key is stored under the misspelled
`RESENT_API_KEY`, so `RESEND_API_KEY` was undefined and every signup since the
newsletter shipped was answered with "the list is not open yet" — the form
worked, nothing was ever sent. `lib/newsletter.ts` now reads either spelling and
warns once per process, so the newsletter works today. **The rename and the
Resend sending-domain verification still need the operator**; the shim is meant
to be deleted once the variable is renamed. See `development.md` §2.

---

## Phase 1 — Automated audit baseline — **done**

**Gate:** `audit/baseline/summary.md` exists with LCP, INP/TBT, CLS and axe
violations by severity. **Met.**

Headline findings: mobile LCP 19.6 s against a 2.4 MB hero JPEG hotlinked from a
publisher's WordPress and painted at 378×236; 13 font preloads for 540 KiB; two
axe violations, both on the home page, nothing critical.

---

## Phase 2 — Content persistence layer — **partial**

Story pages need stable permalinks, and the pipeline holds items only inside a
5-minute cache window — an item that rolls out of the range filter becomes
unreachable.

Merged: `supabase/migrations/20260806000000_articles.sql` (SHA-256 fingerprint as
PK, `first_seen_at`, `last_seen_at`, nullable `canonical_id` self-FK, RLS on with
no policies as a deliberate deny-all), `lib/article-store.ts` (PostgREST upsert
over `fetch`, no new dependency, bounded by a 3-second reserve taken *out of* the
model stage so `AGGREGATE_BUDGET_MS` stays the ceiling), and `deduplicator.ts` now
recording `alternateSourceIds[]` — which outlets carried a story, not merely how
many — captured at the only moment that answer exists.

**Gate:** `SELECT count(*) FROM articles` grows monotonically across three
aggregation runs 10+ minutes apart. **Not met yet — but no longer blocked.**

A project now exists: `wfmurwsagrosxgcihbgw`, REST origin verified reachable. It
is not visible to the Supabase MCP connection used here (different account), so
the migration could not be applied from this side. Two operator steps remain —
paste the migration into the SQL editor, set `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` on Netlify. Runbook and verification queries in
`development.md` §1.

Everything above stays inert until those two variables are set, and is verified
not to run without them.

**Unblocks:** Phase 3's permalink durability, Phase 7 entirely.

---

## Phase 3 — Story pages + SEO remediation — **done**

**Gate met**, verified against production:

```bash
sitemap.xml <url> count      464   (must be > 6; was 6)
NewsArticle JSON-LD            1   (must be >= 1)
unknown /story/{id}          404   (a real 404, not a soft one)
news-sitemap.xml entries     448
axe on a story page            0 violations, any severity
```

Every `NewsArticle` property Google's Rich Results Test requires is present and
well-formed — `headline` (54 chars, under the 110 it truncates at),
`datePublished`, `dateModified`, `author`, `publisher` with `logo`,
`mainEntityOfPage`. The interactive Rich Results Test itself still wants a human
with a browser; the structural check is scripted above.

**The display cap** is in `lib/story-excerpt.ts` and governs every reader-facing
surface — page body, `og:description`, `twitter:description` and the JSON-LD
`description`. 400 characters, broken on a sentence boundary where one exists,
including the Devanagari danda. Verified on the longest story in a live feed:
**2,638 characters held, 392 rendered.** Eight tests cover it; one exists purely
to fail if the cap is ever removed. The outbound "Read the full story at
{sourceName}" is a primary button directly beneath the headline, above both the
excerpt and the image.

`author` in the schema is the originating newsroom and `publisher` is EkJhalak,
with `isBasedOn` pointing at the source article — the accurate claim, and the one
that makes the schema safe to publish.

Story pages render in the language the newsroom filed in, with `lang` on every
text node and the translation offered beneath in its own. That is the Phase 0
finding — the Nepali half of the site was invisible to search because everything
served as `lang="en"` on one URL.

Card headlines became real anchors that intercept a plain left-click to open the
reading panel; modified and middle clicks navigate, so open-in-new-tab works for
the first time.

**Two findings worth keeping:**

the loading UI had to move from `app/` root into `app/(feed)/loading.tsx`. A `loading.tsx`
wraps its segment in Suspense and Next.js flushes that shell as HTTP 200 before
the page renders, so `notFound()` produced the not-found UI under a 200 — a soft
404 telling Google an expired permalink is a live page. Measured: 200 with the
file at `app/` root, 404 without.

D2 is fixed as part of this phase. `NEXT_PUBLIC_SITE_URL` was never set in
Netlify, so the code default ran in production — and it named `www.ekjhalak.news`,
which 301s to the apex. Every canonical tag, `og:url`, sitemap `<loc>` and JSON-LD
`@id` pointed at a host the site redirects away from. Now one `lib/site-url.ts`.

**Item 6(a) is still an open decision.** The brief recommends real `/ne/*` routes
as the only version that actually gets Nepali content indexed as Nepali, and says
to confirm scope with the operator first. What shipped is 6(b) — correct `lang`
on every text node, which fixes the screen-reader half of the problem and is the
stated minimum. Real locale routes are a larger change and need a decision.

**Known limit:** with Phase 2 unprovisioned these resolve against the live feed,
so a permalink is valid only while its story is inside the aggregation window.
`lib/story-lookup.ts` is the single seam that changes when the table goes live.

---

## Phase 4 — Performance remediation — **partial**

**Gate:** re-run Phase 1's exact Lighthouse commands; mobile LCP under 2.5 s, CLS
≤ 0.1. **CLS met (0.000). LCP target missed.**

Mobile 67 → 86 (LCP 19.6 s → 4.2 s median, 2.7 s best), desktop 77 → 99 (4.3 s →
0.9 s), total bytes 3,444 → 767 KiB, third-party bytes eliminated, best practices
96 → 100 on both. Full numbers and the three-run spread in
`audit/post-perf/summary.md`.

Two results worth carrying forward: the largest single win was not a network fix —
`.reveal` sets `opacity: 0` in the server HTML, so the fold waited on hydration
while its image had been downloaded since 1.4 s. And prefetching the rest of the
feed cost LCP identically on mount (5.9 s) and on idle (3.9 s); only not fetching
until a reader asks (2.6 s) helped, because the cost was re-ranking the feed, not
the request.

**Item 4 (bundle analysis) — done.** Nothing to cut, which is the useful result:
every dependency is imported, there is no date library, no markdown library, one
icon library with 19 icons, and no server code in any client chunk. Made
permanent rather than left as a happy accident — seven modules now import
`"server-only"`, so importing the aggregator or summarizer from a client
component is a build error rather than a bundle shipping secrets and prompts.

**Remaining:** mobile LCP is 3.0 s median against a 2.5 s target, and what is
left is main-thread, not network — on a slow run every request finishes by 1.14 s
and images by 0.62 s, three seconds before LCP is recorded. See
`development.md` §3, which also records the three theories already tested so the
fourth is not a guess.

---

## Phase 5 — Accessibility remediation — **done**

**Gate met.** axe-core 4.12.1 against the Phase 1 URL set — `/`, `/about`,
`/editorial-standards`, `/privacy`, `/terms`, `/contact` — reports **zero
violations at any severity**, not merely zero critical/serious.

The baseline's two findings are both closed:

- `color-contrast` (serious, 6 nodes) — every instance was an `opacity-*` utility
  multiplying a colour that passed contrast as an authored token. Opacity
  multiplies the resolved colour, which is why `scripts/check-contrast.mjs` could
  never see it: that script reads token pairs, and the failure only exists after
  render. Fixed by removing both dimmers and lifting `--ink-muted` in each theme.
- `landmark-unique` (moderate, 1 node) — the sticky topic bar and the footer's
  link list were both announced as "Sections", so listing landmarks gave two
  identical entries. Now Topics / Pagination / Sections.

**Keyboard pass, done in a real browser** rather than asserted. 163 focusable
stops, no positive `tabindex`, skip link present and targeting a real
`#main-content`. Every input carries an accessible name — the first audit script
flagged four, which was the script failing to check `<label for>` rather than a
defect.

The focus indicator took three wrong measurements before it was read correctly,
which is worth recording: `.card-focus` sets `outline: none` on the element and
paints the ring on a `::after` positioned against the card, so reading
`getComputedStyle(el)` reports no outline and looks like a WCAG 2.4.7 failure.
Reading `getComputedStyle(el, '::after')` after a real Tab press shows
`solid 2px var(--red)` around the whole card, and a screenshot confirms it. Nearly
"fixed" something that was already correct.

`pnpm check:a11y <url>` runs the scan and exits non-zero on critical/serious.

---

## Phase 6 — Best practices remediation — **done**

**Gate met** — Lighthouse Best Practices **100 on both** mobile and desktop,
against a required 95.

1. CSP tightened: `'unsafe-eval'` is gone from `script-src` in production. Next.js
   needs it for dev-mode stack reconstruction and HMR, not for the production
   bundle — the comment above it already said so while shipping it anyway.
   Verified the built site runs under the tightened header.
   `'unsafe-inline'` stays, with a reason rather than a dated TODO: replacing it
   needs a per-request nonce, which needs dynamic rendering, and this homepage is
   ISR specifically so readers get static HTML. Not a trade worth making on a page
   with no third-party script and no user-generated HTML, where both inline
   scripts are ours.
2. `theme-color` added for both themes.
3. The score reached 100 partly by deleting `@vercel/speed-insights`, whose script
   404s on this deployment and whose beacon `connect-src 'self'` would block
   regardless — a failed request on every page load for telemetry Vercel could
   never receive.

---

## Phase 7 — Auth + personalization — **blocked**

Blocked on Phase 2 being wired up — the project exists, two setup steps remain.
See `development.md` §1.

Supabase Auth, followed sources/buckets, personalized homepage for logged-in
users with the anonymous experience unchanged, reading history.

Blocked on Phase 2 provisioning. Single-tenant and single-brand; no second
identity system.

---

## Phase 8 — Monetization infrastructure — **blocked**

Blocked on Phase 7, which is blocked on Phase 2 being wired up. See
`development.md` §1 and `MONETIZATION.md`.

Stripe Checkout + Billing Portal + signature-verified webhook, a paywall boundary
at the story-page and digest level that never touches the free ad-free homepage
feed, a daily digest on the existing Netlify scheduled-function pattern, and an
NPR rail (eSewa/Khalti) alongside USD.

Blocked on Phase 7.

---

## Phase 9 — Full re-verification — **done**

**Gate met — no regressions on any tracked metric.** Full table in
`audit/final/summary.md`; medians of three mobile runs and two desktop.

| Metric | Baseline | Target | Final |
| --- | --- | --- | --- |
| Mobile LCP | 19.6 s | < 2.5 s | **3.0 s** — improved 85%, target missed |
| Mobile CLS | 0.000 | ≤ 0.1 | **0.000** |
| Desktop CLS | 0.002 | ≤ 0.1 | **0.005** |
| axe critical + serious | 1 | 0 | **0** |
| Best Practices | 96 | ≥ 95 | **100** both |
| sitemap URLs | 6 | > 6 | **465** |

Category scores: mobile 67 → **94** performance, 97 → **100** accessibility,
96 → **100** best practices, SEO 100. Desktop **100 across all four**. Total page
weight 3,444 → **705 KiB** mobile, 4,744 → **957 KiB** desktop.

Desktop CLS moved 0.002 → 0.005 — a twentieth of the budget, and mobile CLS is a
flat zero across three runs. Recorded rather than rounded to "unchanged".

Mobile LCP misses its 2.5 s target at 3.0 s median (3.0 / 2.8 / 4.1). Not written
off: what remains is main-thread, not network — on a slow run every request
finishes about three seconds before LCP is recorded and TBT is 22 ms, so it is
neither bandwidth nor a long task. The suspect is the post-hydration re-render
that repaints above the fold, and it deserves the same measure-then-change
treatment the three network theories got in Phase 4 rather than a guess.

---

## Phase 10 — Documentation — **done**

**Gate met.** Every internal link and every backticked repo path in `README.md`,
`MONETIZATION.md` and this file resolves — checked by script, not by eye.

`README.md` gains a **SaaS Layer** section covering story-page routing and the
permalink-window caveat, the display cap *and why it exists* stated plainly
enough that a future contributor cannot remove it by accident, the structured
data and its authorship claim, both sitemaps, the verification gates and what
each catches that the others cannot, the `server-only` boundary, and what was
deliberately not built.

Two corrections were needed, both of the same kind — documentation describing
features that were never built:

- The **Admin API** section documented six endpoints and an `INGEST_HMAC_SECRET`
  signing scheme. None exist; the variable appears nowhere in the source. Kept as
  an explicit note rather than deleted, so a contributor who read the old version
  learns it was fiction instead of concluding the endpoints were removed.
- **Database Setup** described a `DATABASE_URL`, a transaction pooler, an
  initial-migration file and a sources seed file — none of which exist either.
  Replaced with the real thing: two env vars, one migration, PostgREST over
  `fetch`, sources in code.

`MONETIZATION.md` is now standalone with a dated changelog separating what
shipped from what is still planned, and the README points at it. Roadmap items 3
and 10 are marked partly shipped with what actually landed.
