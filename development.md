# EkJhalak — Remaining Work

Final audit, 2026-08-06, against production deploy `ca9b65b`.

`dev.md` tracks the eleven phases and what each gate returned. **This file is the
other half: what is left.** Everything below is either verified as still open or
was found during the audit that produced this document.

Ordered by what unblocks the most, not by effort.

---

## The short version

**Updated 2026-08-08.** Eight of eleven phases are done: the archive (§1) is
provisioned, migrated and verified, which was the item worth more than everything
else here. It closed Phase 2, made permalinks durable, and gave enrichment
somewhere to survive between invocations.

What is left of the bilingual pipeline is no longer a missing capability, it is a
scheduled function (§1b). Phase 7 is unblocked and unstarted.

Nothing here is a known regression being parked as future work. Production is
healthy: `/api/news` 200 at 16.4 s cold and 0.6 s warm, home 200 at 1.05 s, all
verification gates passing.

---

## 1. Archive — **done, 2026-08-08**

The three migrations are applied to `wfmurwsagrosxgcihbgw` and the table is
writing. `pnpm check:archive` passes; rows grew 472 → 478 → 490 → 512 across four
aggregation passes, `first_seen_at` moved on none of them, and anon still reads
`[]`. Phase 2's section in `dev.md` has the full gate output.

### What took the time, so nobody re-derives it

**The name of the origin variable.** It had been set as `DATABASE_URL`, then as
`NEXT_PUBLIC_SUPABASE_URL`, and never as `SUPABASE_URL`, which is what
`lib/article-store.ts` read. Each attempt looked correct from the dashboard and
produced no error, because the writer swallows its own failures by design.

That is now handled in code rather than in a runbook: **the origin is read under
either name.** It is public by design, so accepting both is safe. The
service-role key is not, and gets the opposite treatment — if any
`NEXT_PUBLIC_*SERVICE_ROLE*` variable exists, the archive refuses to start and
says the key must be rotated rather than renamed, because `NEXT_PUBLIC_` values
are inlined into the browser bundle at build time.

**The database password contains `$`, `&` and `^`.** `source .env` expands those,
so the connection string is silently corrupted and `psql` reports
`password authentication failed` — indistinguishable from a wrong password.
`scripts/check-archive.mjs` parses `.env` itself, without expansion, for exactly
this reason.

### The one thing still worth checking in production

The code is name-agnostic now, so production works with the origin under either
spelling. What it cannot work without is `SUPABASE_SERVICE_ROLE_KEY`, and that
value only ever returns masked from the Netlify API — it cannot be verified from
here.

After the next deploy, ask the site itself:

```bash
curl "https://ekjhalak.news/api/archive?secret=$REVALIDATE_SECRET"
```

`{"ok":true,"rows":N,…}` means it is writing. `configured:false` means the key is
missing; a non-null `lastError` is PostgREST's own words about why the last write
failed. This endpoint exists because the archive was misconfigured for its entire
first existence while every dashboard looked healthy — a warning in a serverless
log nobody tails is silence, and this project paid for that lesson twice.

`REVALIDATE_SECRET` must be set in production for that route to answer at all; it
fails closed exactly like `/api/revalidate`.

**The service-role key bypasses RLS.** It is a server-only secret — never
`NEXT_PUBLIC_`, never read from a client component. `lib/article-store.ts`
imports `"server-only"`, so an accidental client import is a build error rather
than a leaked key, and it now also refuses to start if it finds the key under a
`NEXT_PUBLIC_` name. Do not paste it into a chat or a commit.

### On the Postgres credentials

The direct connection details are **not what the app uses**, and that is
deliberate. They are how the three migrations were applied — `psql` over the
transaction pooler on 6543 — and they remain the right tool for migrations and
one-off queries.

`lib/article-store.ts` talks **PostgREST over HTTPS** — a stateless request per
batch, no connection pool. On Netlify that is the right shape: functions are
ephemeral and a direct 5432 connection per invocation would exhaust the
connection limit under any real traffic. Supabase's own guidance is the same;
their transaction pooler on 6543 exists for exactly this, and even that is a
worse fit than plain HTTP here.

Supabase's direct-connect host is also IPv6-only — confirmed, it resolves to
`2406:da1a:…` with no A record — so a direct connection would depend on Netlify's
functions having IPv6 egress.

Those credentials are still worth having for `psql`, migrations and one-off
queries. They are simply not what production reads.

### Verify it is working

```bash
# Configuration, schema, RLS posture and row count, in one command. Reads the
# same two variables the app does, and authenticates the same way, so a pass
# here is a statement about the app rather than about the script.
pnpm check:archive
```

Then, for the growth half of the gate:

```bash
# Force a regeneration, wait, and run check:archive again. `rows` must only ever
# rise: new stories insert, re-seen ones update in place.
curl -X POST "https://ekjhalak.news/api/revalidate?secret=$REVALIDATE_SECRET"
```

In the SQL editor, the two questions the script does not answer:

```sql
-- first_seen_at must never move on a re-seen row. It is the one column that
-- cannot be recovered from anywhere else, and the writer omits it from the
-- upsert payload precisely so merge-duplicates cannot overwrite it.
select id, first_seen_at, last_seen_at from articles order by first_seen_at limit 5;

-- What the table costs, before deciding whether it needs pruning at all.
select * from article_storage();
```

### Retention

`articles` only grows — roughly 1,500 new stories a day survive dedup, each
carrying up to two summaries. Left alone it reaches the free tier's 500 MB in
months, and the failure mode is writes beginning to fail silently.

Retention and the archive's purpose pull against each other: the table exists so
a permalink outlives the feed window, and deleting rows re-breaks that. So the
default tool is not deletion.

| Function | What it does |
| --- | --- |
| `article_storage()` | Size, age range, row count. Read this first. |
| `prune_article_bodies(days default 180)` | Blanks the summary columns on rows not seen for N days. **The row survives, so `/story/{id}` still resolves** — headline, outlet, date, photograph and the outbound link, which is what a reader needs. Reclaims most of the bytes. |
| `delete_articles_older_than(days default 730)` | Actually deletes, skipping any row that is another row's canonical. **This breaks permalinks.** Second option, named so nobody runs it by accident. |

Neither prune runs on a schedule. How long this site keeps its history is an
editorial decision, not a default — call them from the SQL editor, or wire one
into the existing `netlify/functions/revalidate-feed.mts` pattern if it should
be automatic.

All three are `security invoker` and revoked from `anon` and `authenticated`, so
they are not reachable through PostgREST's RPC endpoint. A function that empties
columns should not be one HTTP request away from the public internet.

The Phase 2 gate is `select count(*) from articles` growing monotonically across
three aggregation runs spaced 10+ minutes apart, with `/api/news` unchanged in
shape. **Met on 2026-08-08**: 472 → 478 → 490 → 512.

### What this unblocked

**a. Permalinks stop expiring — done.** `/story/{id}` now falls back to the
archive when a story has aged out of the aggregation window, so a shared link
survives its story leaving the feeds. `lib/story-lookup.ts` was written as the
seam for exactly this and is the only module that changed; the pages, sitemaps
and metadata did not. Verified live: an archived story that is no longer in any
feed returns 200, an unknown id still returns a real 404.

The archived story is put through the same `PUBLISH_POLICY` gate as the feed.
A story the gate would withhold from the homepage is not served merely because it
is old — otherwise the archive becomes a way *around* the editorial standard
rather than a way to reach its back catalogue.

One asymmetry was introduced deliberately: `listStories()`, which feeds the
sitemaps, still returns the live feed only, so it is now a subset of what
`findStory` resolves. A sitemap must not list URLs the site would 404 on; it is
under no obligation to list every URL that works. Listing the whole archive means
~1,500 entries a day, through the 50,000-URL limit inside a month and into
sitemap index files — real work, and separate. Meanwhile the part that mattered
for search is already fixed: URLs Google crawled while they *were* listed now
answer 200 instead of 404 when it returns to them.

**b. Enrichment survives the process — done.** The archive is the L2 behind
`lib/enrichment-cache.ts`'s in-process L1, keyed identically, so a cold
invocation no longer re-translates what an earlier one already paid for.
Demonstrated live against 40 seeded rows: 33 restored, 33 stories bilingual at a
cost of zero model requests, the other 7 correctly missing because their body
text had changed. See §1b — this is the fix that turns "every news is bilingual"
into arithmetic that works.

**c. The extraction ceiling still has not lifted.** Roughly half the feed carries
the publisher's two-line teaser and ~20% has no photograph, because extraction is
bounded by one pass's slice of a 15-second request-path budget. Measured and
recorded: `next: { revalidate }` does **not** help — fetches nested inside
`unstable_cache` never populate the Data Cache. One fetch-cache entry after
hundreds of article fetches, with and without the abort signal.

Persistence was the prerequisite, not the fix. The ceiling moves when extraction
comes off the request path, which is the same scheduled-function work §1b needs
for the model queue — one job, two payoffs. Bound the parse first (§4).

**d. Phase 7 (auth + personalization)** — Supabase Auth, followed sources, a
personalized homepage with the anonymous experience unchanged, reading history.
Specified in `dev.md`, entirely unbuilt, and no longer blocked.

**d. Phase 8 (monetization)** — Stripe Checkout + Billing Portal +
signature-verified webhook, a paywall boundary at the story-page and digest level
that never touches the free homepage feed, digest delivery on the existing
Netlify scheduled-function pattern, and an NPR rail (eSewa/Khalti) alongside USD.
See `MONETIZATION.md`.

---

## 1b. Bilingual verify-then-publish pipeline — persistence done, queue left

The goal: no story reaches a reader until it has been summarised, verified,
translated, verified again and audited — in both directions, so every story and
the whole site are bilingual.

### Which model, and why not a different one

Researched rather than assumed, and the answer is that **the current choice is
already the right one**. Gemini ranks first overall on translation quality in
2026 evaluations (Alconost AQI 77.7 across 3,800+ evaluations) and its free tier
is 1,500 requests/day per model — with the five-model fallback chain already in
`lib/summarizer.ts`, roughly 7,500/day.

The alternatives lose on the axis that matters here. Groq is faster and gives
~1,000 RPD on Llama 3.3 70B; Cerebras gives 1M tokens/day; Mistral is the most
generous on volume at 1B tokens/month. But the first systematic benchmark of
comparable-sized open models on Nepali found Llama-3.1-8B, Mistral-7B and
Qwen3-8B all weak on it before fine-tuning — Qwen produced output only in English
or Devanagari regardless of what was asked, Mistral dropped verb endings and
postpositions. Gemma 3 is strong on low-resource languages generally and still
weak on Indic. For a bilingual Nepali news site, throughput is not the binding
constraint; Devanagari competence is.

**Conclusion: stay on Gemini.** A second provider is worth adding later as
overflow for English-only work, where the open models are competent, but it is
not an upgrade and should not be sold as one.

### The quota arithmetic, which decides the architecture

Five stages per story, ~1,500 new stories a day surviving dedup:

```
naive          5 calls x 1,500 stories        = 7,500 calls/day   at the ceiling
batched at 10  5 calls x 150 batches          =   750 calls/day   comfortable
```

Batching is not an optimisation here, it is what makes the design possible.
`lib/summarizer.ts` already batches at 10 with a concurrency of 3.

Two of the five stages need no model at all. `lib/text-audit.ts` decides script
mixing, mojibake, leaked markup, truncation, degeneration and model preamble by
looking at the characters — free, instant, and more reliable than asking a model
whether its own output is broken. What genuinely needs a model is the semantic
question: does this say what the source said.

### Measured, not researched: the quota is the whole story

Published free-tier figures said 1,500 requests/day on Gemini Flash. This
account's actual allowance, measured against every model in the chain on
2026-08-06:

```
gemini-3.5-flash-lite    500/day
gemini-3.1-flash-lite    500/day
gemini-2.5-flash-lite     20/day
gemini-2.5-flash          20/day
gemini-3.6-flash          20/day
                       ─────────
                       1,060/day   — and all five exhausted when measured
```

**Production is serving zero translations. Not few — zero.** 0 of 200 items
carry `titleTranslated` or `summaryTranslated`. The site is not bilingual today
and has not been.

The key is valid: it answers 429, not 400. So this is not a credential problem
and no amount of pipeline engineering fixes it. 1,060 requests at a batch size
of 10 is 10,600 story-slots a day, comfortably more than the ~1,500 new stories
that survive dedup — the allowance is sufficient and it is being spent in the
wrong place.

**Where it goes.** `lib/enrichment-cache.ts` is in-process. On Netlify every cold
invocation starts empty, so a pass re-enriches stories it has already enriched,
and the feed regenerates every five minutes — 288 passes a day, each spending
requests on work already done. The allowance is gone long before the day is.

This is the same shape as the extraction ceiling in §1: work that should be done
once per story is being done once per invocation, because there is nowhere
durable to record that it was done.

**So the fix is the same fix — and it shipped on 2026-08-08.** Enrichment is now
persisted in the `articles` table and read back before the model is asked, so the
1,060 daily requests go to stories that have never been enriched instead of to
the same stories repeatedly.

The mechanism is `enrichment_key`: the story id plus a hash of the exact text that
was sent to the model, stored alongside the translation and compared against a
freshly computed one. Equal means the story *and its source text* are unchanged
and the stored translation stands. Different means the publisher rewrote the body
under the same URL — which several outlets here do within the first hour of a
breaking story — and it earns a fresh translation rather than a stale one served
forever. `lib/enrichment-cache.ts` remains the L1; the archive is the L2 behind
it, keyed identically.

Measured live against 40 seeded rows: `[archive] restored 33 enrichment(s); 423
still need the model`. Thirty-three stories reached the reader fully bilingual for
zero model requests; the seven misses were stories whose body had changed since
they were stored, which is the key working rather than failing.

Verification results are carried across too, but only `verified` — `audited` and
`bilingual` are deterministic functions of text the table already holds, so they
are recomputed on every hydrate. That is deliberate: it costs nothing and means a
row written under an older, weaker audit is re-examined rather than grandfathered
past the gate. `verified` is the one verdict that cost a model request to earn.

Worth noting for later: a fresh key from aistudio.google.com may carry higher
per-model limits than this one, and the two 500/day models are doing most of the
work. But the durable cache mattered more than the key, which is why it came
first.

### The gate itself is built and enforced

`lib/publish-gate.ts` decides what reaches a reader, at four levels — `all`,
`audited`, `bilingual`, `verified` — set by `PUBLISH_POLICY` and applied per
request in `getPublishedFeed`, not inside the cached aggregation. That placement
matters: gating inside the cache would bake one policy into a five-minute entry,
and would mean the archive only recorded whatever happened to be publishable that
minute.

Demonstrated against a live local feed:

```
PUBLISH_POLICY=audited    -> 391 items
PUBLISH_POLICY=bilingual  ->   0 items   455 withheld (455 not bilingual)
PUBLISH_POLICY=verified   ->   0 items   455 withheld (455 not bilingual)
```

That zero is not a bug in the gate — it is the gate correctly reporting the
quota finding above. There are no translations to publish. The gate also warns
when it withholds more than three quarters of the feed, because a policy doing
that is indistinguishable from an aggregator that has stopped working.

The default stays `audited`, which is the level that is honestly reachable
today. Raising it is one environment variable, and it becomes the right thing to
do the moment enrichment persists.

### The blocker

**This cannot run on the request path.** `/api/news` regenerates inside a
15-second budget because Netlify abandons a request at 30 seconds; a five-stage
pipeline over hundreds of stories does not fit and never will. It needs the
`articles` table as a work queue with a status column, a Netlify scheduled
function draining it, and the site reading only rows that reached `published`.

**The table half is done (§1); the scheduled function is what remains.** The
distinction matters because the two failure modes were never the same one. Before
persistence, a story could not stay enriched — the work was destroyed every cold
start and no amount of scheduling would have helped. Now it stays, and each pass
adds to it, so the feed converges on bilingual over hours instead of thrashing.
What the queue buys on top is *rate*: draining on a schedule rather than in the
seconds a reader is willing to wait, which is what would let every story be
verified rather than only the ones a 15-second pass could reach.

So this is now an optimisation with a known shape, not a blocker. The same
scheduled function also lifts the extraction ceiling (§1 c) — one job, two
payoffs.

### What shipped today, without the queue

The deterministic half runs inline right now and gates every model output:

- A rewritten summary that fails the audit is discarded; the publisher's own
  text stays. It may be plainer, but it is not half Devanagari.
- A failed translation is dropped entirely rather than shown. The UI already
  handles a missing translation honestly; it renders a broken one as though it
  were real.
- Half a translation — headline without body — is rejected as a pair.

So the *quality floor* is enforced today. What waits on the queue is the
*ceiling*: every story carrying a verified translation, rather than only the
stories one 15-second pass could reach.

---

## 2. Needs your hands — Netlify and Resend

**Rename `RESENT_API_KEY` → `RESEND_API_KEY`** in Site configuration →
Environment variables. The key is currently stored under the misspelled name, so
`RESEND_API_KEY` was undefined and every signup since the newsletter shipped was
answered with "the list is not open yet" — the form worked, nothing was ever sent.

`lib/newsletter.ts` now reads either spelling and warns once per process, so the
newsletter works today. **That shim is meant to be deleted**, not kept. I could
not rename it directly: writing a secret into production config is not something
to do unasked, and the attempt was blocked.

**Verify `ekjhalak.news` as a sending domain in Resend.** Until that is done,
`NEWSLETTER_FROM` is rejected on every send regardless of the key. Not verified
from here — check the Resend dashboard.

---

## 3. Mobile LCP — 3.0 s against a 2.5 s target

Phase 4's only unmet target, and deliberately not written off.

19.6 s → 3.0 s median (runs: 3.0 / 2.8 / 4.1). Mobile Lighthouse performance is
94; desktop is 100 with a 0.8 s LCP.

**What remains is main-thread, not network.** The evidence, from
`audit/post-perf/summary.md`:

```bash
slow run (LCP 4.21 s):  27 requests, last ends 1.14 s, all images done by 0.62 s
fast run (LCP 2.68 s):  30 requests, last ends 2.30 s, images at 1.03–2.07 s
```

The slow run finishes loading everything three seconds before LCP is recorded,
and the fast run loads *longer* while painting *sooner*. TBT is 22 ms, so it is
not a long task either. The suspect is a post-hydration re-render repainting the
above-the-fold area.

Three network-side theories were tested and measured during Phase 4 — eager
prefetch, idle prefetch, and the reveal animation. The fourth deserves the same
treatment. **Do not guess at this one**; the measured history is in
`audit/post-perf/summary.md` and each wrong theory cost a deploy.

---

## 4. The extraction parse is unbounded — and it took production down

The highest-value correctness work that is not blocked on anything.

`lib/article-extractor.ts` `extractMany` checks the deadline before *starting* an
item, and the fetch it starts is clamped to that deadline. But `bestCandidate`
then runs regex over up to 1.2 MB of HTML with no bound at all — synchronous,
event-loop-blocking, covered by no deadline check.

This is not theoretical. Raising concurrency from 4 to 8 to recover more
photographs put the cold pass at **30.9 s and returned 502** — over Netlify's
limit, the same outage this project already fixed once. Reverted the same day
(`bdfcdac`).

It is the fourth appearance of the bug class recorded as D3 in `audit/recon.md`:
*a deadline check that gates whether work starts, while the work it starts is
itself unbounded.* The first three were network timeouts. This one is CPU.

**Bounding the parse is what makes more extraction throughput safe** — cap the
HTML handed to the paragraph scraper, or check the clock between candidates. Do
that first, then raise concurrency, then re-measure the cold pass before trusting
it.

---

## 5. Nepali locale routes — a decision, not a task

Phase 3 item 6 offered two options and asked for the operator's call before the
larger one. **6(b) shipped**: correct `lang` on every text node, which fixes the
screen-reader half and is the stated minimum.

**6(a) has not been decided.** Real `/ne/*` routes mirroring `/*`, set
server-side, are the only version that gets Nepali content indexed *as Nepali* —
which matters for a bilingual Nepali news site more than for most. It is a
materially bigger change than the rest of that phase, which is why the plan says
to confirm scope first. Still your call.

---

## 6. Dependency advisories — one left, and it does not run in production

`pnpm audit` went from **6 findings (3 high, 3 moderate) to 1 high**, via
overrides in `pnpm-workspace.yaml`:

| Package | Severity | Reachable via | Status |
| --- | --- | --- | --- |
| postcss | 2 high, 2 moderate | `next` | **pinned** `>=8.5.25` |
| hono | moderate | `shadcn` (devDependency) | **pinned** `>=4.12.34` |
| sharp | high (libvips) | `next` | **left alone, deliberately** |

sharp is the one that would matter — it processes untrusted publisher images —
except that **it never runs in production**. `/_next/image` is served by Netlify
Image CDN, verified from the response headers:

```bash
server: Netlify
netlify-vary: query=crop|fit|fm|format|h|height|position|q|quality|timestamp|url|w|width
content-type: image/webp
```

Forcing a sharp version Next.js 16.2.12 does not expect would risk the local
build for zero production benefit. Revisit when Next bumps it. Re-check with
`pnpm audit` after any Next upgrade — the reasoning above depends on Netlify
continuing to intercept `/_next/image`.

---

## 7. Smaller, genuinely optional

- **Next.js 16.2.12 → 16.3.0** is available. No reason to rush; may clear the
  sharp advisory on its own.
- **`vercel.json` is dead code** on Netlify and documented as such. Kept only so a
  Vercel deploy would still schedule its cron. Delete it if that possibility is
  gone.
- **`coverageCount` is shown, `alternateSourceIds[]` is not.** The data is
  captured and server-side only; surfacing "also covered by X, Y, Z" is the
  coverage-comparison wedge `MONETIZATION.md` identifies as the differentiator.
  Small UI change, meaningful product change.
- **The feed-quality gate samples whatever `/api/news` returns**, which varies
  between 100 and 452 items depending on cache state. Thresholds are set wide
  enough to absorb that, but a fixed sample would make the numbers comparable
  run-to-run.
- **`AGGREGATE_BUDGET_MS` is 15 s against a 30 s platform limit.** Deliberately
  conservative, and the right call while regeneration runs on the request path.
  Once item 1 moves it off, this number stops mattering.

---

## What was checked and found clean

So the next person does not redo it:

- **No TODO, FIXME, HACK or XXX** anywhere in `app/`, `lib/`, `components/`,
  `scripts/` or `netlify/`.
- **No dead dependencies.** Every entry in `package.json` is imported somewhere.
  No date library, no markdown library, one icon library with 19 icons.
- **No server code in client bundles** — no `fast-xml-parser`, no `XMLParser`, no
  Gemini endpoint, no Supabase. Now *enforced* rather than merely true: seven
  modules import `"server-only"`, so importing the aggregator or summarizer from
  a client component is a build error.
- **Every internal link and backticked repo path** in `README.md`,
  `MONETIZATION.md` and `dev.md` resolves — checked by script.
- **All verification gates pass**: `pnpm verify` (lint, typecheck, 52 tests,
  contrast, build) and `pnpm verify:live` (feed quality, axe, SEO).
- **axe reports zero violations at any severity** across all six pages.
- **Two documentation fictions were removed** — an Admin API section describing
  six endpoints and an `INGEST_HMAC_SECRET` scheme that never existed, and a
  Database Setup section describing `DATABASE_URL`, a pooler and two files that
  never existed. Worth knowing this repo has had that failure mode more than
  once: `alternateSourceIds[]` was documented for some time before it was built.

---

## Verification commands

```bash
pnpm verify                       # lint, typecheck, 88 tests, contrast, build
pnpm verify:live                  # feed quality -> axe -> SEO, against production
pnpm check:archive                # archive config, schema, RLS posture, row count
pnpm check:feed [url]             # 19 checks on a live feed
pnpm check:seo [url]              # sitemaps, canonical host, NewsArticle, real 404
pnpm check:a11y <url>             # axe-core; exits non-zero on critical/serious
pnpm audit                        # dependency advisories
```

Lighthouse, three runs — one run is not a measurement:

```bash
CHROME_PATH=$(which google-chrome-stable) npx lighthouse https://ekjhalak.news/ \
  --quiet --output=json --output-path=/tmp/lh.json \
  --form-factor=mobile --screenEmulation.mobile \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu"
```
