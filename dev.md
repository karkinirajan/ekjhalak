# EkJhalak — Phased Execution Plan

Working tracker for the solo-builder SaaS transformation. Each phase has a hard
verification gate; a phase is not "done" because its code merged, it is done when
its gate command returns the required result.

Status legend: **done** · **partial** · **blocked** · **not started**

| # | Phase | Status | Gate met |
| --- | --- | --- | --- |
| 0 | Recon | **done** | yes |
| 1 | Automated audit baseline | **done** | yes |
| 2 | Content persistence layer | **partial** — code merged, inert | no — not provisioned |
| 3 | Story pages + SEO remediation | **done** | yes |
| 4 | Performance remediation | **partial** | CLS yes, LCP target no |
| 5 | Accessibility remediation | **not started** | — |
| 6 | Best practices remediation | **partial** — score already passes | score yes, items no |
| 7 | Auth + personalization | **blocked** on Phase 2 | — |
| 8 | Monetization infrastructure | **blocked** on Phase 7 | — |
| 9 | Full re-verification | **not started** | — |
| 10 | Documentation | **not started** | — |  

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

**Still open:** D1 — `RESENT_API_KEY` is a typo for `RESEND_API_KEY` in the Netlify
UI, so the newsletter is silently dead. Needs the operator's hands; also needs
`ekjhalak.news` verified as a Resend sending domain or every send is rejected.

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
aggregation runs 10+ minutes apart. **Not met, and cannot be run.** Supabase's
free tier allows two active projects and both slots are occupied by unrelated
projects; the operator chose to leave the archive off for now. Everything above is
inert without `SUPABASE_URL` and verified not to run.

**Unblocks:** Phase 3's permalink durability, Phase 7 entirely.

---

## Phase 3 — Story pages + SEO remediation — **done**

**Gate met**, verified against production:

```
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

`app/loading.tsx` had to move into an `app/(feed)/` route group. A `loading.tsx`
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

**Remaining:** LCP is now main-thread, not network — on a slow run every request
finishes by 1.14 s and images by 0.62 s, three seconds before LCP is recorded.
Item 4 (bundle analysis) is not done.

---

## Phase 5 — Accessibility remediation — **not started**

Skip link, full keyboard pass, contrast audit on both themes, and verifying the
Phase 3 `lang` fix with an actual screen reader.

Known from baseline: `color-contrast` (serious, 6 nodes — every one an `opacity-*`
utility on a pair that passes at full opacity) and `landmark-unique` (moderate, 1
node). A skip link already exists in `app/layout.tsx`, contrary to the audit note
in the brief.

**Gate:** zero critical/serious axe violations across the Phase 1 URL set, plus a
keyboard-only pass through homepage → story page → back with no dead ends.

`pnpm check:a11y <url>` runs the scan and exits non-zero on critical/serious.

---

## Phase 6 — Best practices remediation — **partial**

**Gate:** Lighthouse Best Practices ≥ 95 on both. **Already met — 100/100** as a
side effect of Phase 4 (removing the 404-ing `@vercel/speed-insights` script).

Still outstanding: tighten CSP (`'unsafe-eval'` out of `script-src`, nonce-based
replacement for `'unsafe-inline'` if Next.js hydration allows), and add
`<meta name="theme-color">` for both themes.

---

## Phase 7 — Auth + personalization — **blocked**

Supabase Auth, followed sources/buckets, personalized homepage for logged-in
users with the anonymous experience unchanged, reading history.

Blocked on Phase 2 provisioning. Single-tenant and single-brand; no second
identity system.

---

## Phase 8 — Monetization infrastructure — **blocked**

Stripe Checkout + Billing Portal + signature-verified webhook, a paywall boundary
at the story-page and digest level that never touches the free ad-free homepage
feed, a daily digest on the existing Netlify scheduled-function pattern, and an
NPR rail (eSewa/Khalti) alongside USD.

Blocked on Phase 7.

---

## Phase 9 — Full re-verification — **not started**

Re-run every Phase 1 command; `audit/final/summary.md` as
metric | baseline | target | final.

**Gate:** no regression against baseline on LCP, CLS, axe critical/serious count,
Best Practices score, or sitemap URL count. A known regression gets fixed, not
documented as future work.

---

## Phase 10 — Documentation — **not started**

`README.md` gains a `## SaaS Layer` section — story page routing and
canonicalization, **the display cap and why it exists** so a future contributor
does not helpfully remove it, new env vars in the existing table format, new
endpoints, and a note on why `netlify.toml` is still deliberately absent.
`MONETIZATION.md` becomes a standalone file with a dated changelog of what
actually shipped.
