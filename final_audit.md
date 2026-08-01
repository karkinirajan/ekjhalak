# EkJhalak News — Production Audit

**Branch:** `redesign/dark-four-colour-palette`
**Stack:** Next.js 16.2.1 (Turbopack) · React 19.2.4 · Tailwind v4 · base-ui
**Audited:** 31 July 2026
**Method:** static analysis of every source file, WCAG contrast computed from the
actual token values, compiled-CSS specificity inspection, a production build, and
live measurement against the running feed (475 stories, 41 sources).

Every claim below was verified — measured, computed, or observed at runtime. Where
a number appears, it came from the running system, not an estimate.

---

## Verdict

The codebase is unusually well written. The architecture is sound, the comments
explain *why* rather than *what*, and the editorial thinking (coverage-based
ranking, original-language summaries, no invented engagement metrics) is
genuinely principled.

But three things are quietly broken in ways no test would catch:

1. **The product's headline feature does not work.** `coverageCount` — the signal
   the trending rail is built on and advertises in its subhead — is `1` for all
   475 stories in the live feed. It has never been anything else.
2. **The dark theme fails WCAG on every topic pill**, down to 1.73:1 against a
   4.5:1 requirement, and no story card has a visible keyboard focus indicator.
3. **The homepage ships 477 stories to render 30.**

None of these are visible to someone reading the code. All are visible to a user.

---

## 1 · Critical — functional defects

### 1.1 `coverageCount` is permanently 1 · **the trending rail measures a constant**

The trending rail's subhead promises "Ranked by newsroom coverage, source weight
and freshness." Coverage is never counted, so it ranks on the other two only. The
"N outlets covering" badge on the hero and rail can never render. In
`scoreStory()`, `Math.log2(coverageCount + 1) * 40` is a constant 40 added to
every story — it cancels out entirely.

Two independent causes compound:

**(a) The tokenizer deletes Devanagari.** `lib/deduplicator.ts:17` uses
`.replace(/[^\w\s]/g, " ")`. In JavaScript `\w` is `[A-Za-z0-9_]`, so every
Nepali title reduces to an empty token set and `jaccardSimilarity` returns 0 at
the guard on line 27.

```
tokenize("प्रधानमन्त्रीले संसदमा विश्वासको मत लिए")  →  []
jaccard(np_a, np_b)                                  →  0
```

160 of 475 live items are Nepali. None of them can ever deduplicate — against
each other or anything else.

**(b) The 0.65 threshold is unreachable even in English.** Measured across all
cross-source pairs within the 2-hour window in the live feed:

| tokenizer | pairs ≥ 0.65 | pairs ≥ 0.45 | highest observed |
|---|---|---|---|
| current (`\w`) | **0** | 3 | **0.50** |
| unicode-aware | 11 | 30 | 1.00 |

The single closest English pair in the entire feed — *"Italy World Cup winner and
AC Milan legend Franco Baresi…"* vs *"AC Milan and Italy great Baresi dies aged
66"* — scores 0.50. Different newsrooms write genuinely different headlines; 0.65
Jaccard on titles is a bar real-world coverage does not clear.

**Fix:** make the tokenizer Unicode-aware (`\p{L}\p{N}` with the `u` flag) and
lower the threshold to 0.45. Verified against the live feed: 30 merges, including
one Nepali pair at 1.00 (an identical headline running on two outlets).

---

### 1.2 The Vercel cron targets a route that does not exist

`vercel.json` schedules `/api/cron/enrich` daily. The only routes in the app are
`/api/news`, `/api/revalidate`, and `/api/subscribe`. The cron 404s every day and
the feed cache is never warmed on a schedule.

### 1.3 `/api/revalidate` fails open

```ts
if (envSecret && secret !== envSecret) { return 401 }
```

If `REVALIDATE_SECRET` is unset the endpoint accepts anyone. The comment says
"In production, always set REVALIDATE_SECRET" — but an unset variable silently
publishes an open cache-purge endpoint rather than failing. Auth should fail
closed in production regardless of configuration.

### 1.4 `pnpm install` cannot succeed — the repo's own verify script is broken

`pnpm-workspace.yaml` was committed with the placeholder text still in it:

```yaml
allowBuilds:
  sharp: set this to true or false
  unrs-resolver: set this to true or false
```

Every `pnpm install`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build` and
`pnpm run verify` fails with `ERR_PNPM_IGNORED_BUILDS`. Confirmed locally.

### 1.5 Three lockfiles — CI and Vercel install differently

`package-lock.json`, `pnpm-lock.yaml` and `yarn.lock` are all committed. CI runs
`npm ci`; Vercel detects `pnpm-lock.yaml` and uses pnpm. The two resolve
dependencies independently, so a green CI run does not imply a green deploy. CI
also runs `npx tsc --noEmit` (using `tsconfig.json`) while `package.json` defines
`typecheck` against `tsconfig.typecheck.json` — two different type checks.

---

## 2 · Accessibility — WCAG failures

### 2.1 Every dark-theme solid topic pill fails contrast

`TopicPill` with `tone="solid"` renders `bg-[var(--topic)] text-white`. It is used
on every grid card, the hero, the reader header, and the active category chip.
White on the dark-theme topic colours, computed:

| topic | ratio | | topic | ratio |
|---|---|---|---|---|
| culture | **1.73:1** | | environment | 3.07:1 |
| sports | **1.93:1** | | opinion | 3.08:1 |
| society | **2.01:1** | | breaking | 3.05:1 |
| health | **2.27:1** | | politics | 3.91:1 |
| technology | **2.36:1** | | world | 4.09:1 |
| business | **2.54:1** | | | |

At 11px the requirement is 4.5:1. **All eleven fail; six fail even the 3:1
large-text floor.** The light theme passes everywhere (5.08–8.65:1), so this is
dark-only — and dark is the default for any reader whose OS prefers it.

The CSS comment claims "All eleven verified past 4.5:1 on --surface." That
verification measured the *quiet* tone, not this one. The solid tone was never
checked at all.

**Fix:** a per-theme `--topic-ink` token — near-black in dark, white in light.
Verified: dark min 4.83:1 (world), light min 5.08:1 (business).

### 2.1b The quiet tone fails too — found while fixing 2.1

The original measurement of the quiet tone was itself wrong, and my first pass
above repeated the error. Both measured topic-coloured text against bare
`--surface`. The pill does not sit on `--surface`: it paints
`color-mix(in oklab, var(--topic) 13%, transparent)` behind its own text, so the
background actually composited is a *lighter wash of the same hue*. Against the
real background six more pairings fail:

| theme | topic | on `--surface` (as measured) | on the real 13% wash |
|---|---|---|---|
| dark | politics | 4.70 ✓ | **4.14** ✗ |
| dark | world | 4.49 | **3.97** ✗ |
| light | politics | 4.89 ✓ | **3.97** ✗ |
| light | business | 4.66 ✓ | **3.94** ✗ |
| light | health | 4.90 ✓ | **4.12** ✗ |
| light | opinion | 4.91 ✓ | **4.18** ✗ |

Lowering the tint does not rescue it — at 4% the worst case only reaches 4.32.
The colours themselves are marginal. **Fix:** the smallest hue-preserving step
on those six values (lighter in dark, darker in light), with `--red` kept equal
to `--topic-politics` as the palette intends. All 62 pairings now pass, and
`scripts/check-contrast.mjs` enforces it in CI so the next person cannot make
this mistake by hand.

### 2.2 No visible keyboard focus on any story

All four `StoryCard` variants apply `focus-visible:outline-none` to the headline
button with nothing replacing it (`story-card.tsx:102, 149, 197, 253`). The
global `:focus-visible { outline: 2px solid var(--red) }` in `@layer base` loses
to the utility on specificity (0,2,0 vs 0,1,0). There is no `group-focus-within`
rule either.

**22 focusable story controls on the homepage, none of which show focus.**
WCAG 2.4.7 (AA) failure — the page is unusable by keyboard.

### 2.3 The primary red CTA fails contrast in dark

White on `--red` `#e5484d` is **3.91:1**. This is the Subscribe button, the
newsletter submit button, the full-width breaking ticker, and `--primary-foreground`
for every shadcn `default` button. Light theme passes at 5.34:1.

**Fix:** a `--red-solid` fill token for red surfaces carrying white text —
`#d13c41` in dark (4.74:1 with white, 4.18:1 against canvas), leaving `--red`
unchanged for text and rules where it already passes at 5.06:1.

### 2.4 Trending rank numerals are effectively invisible

`text-rule-strong` `#3a3a40` on `--surface` `#141416` is **1.63:1**. They are
`aria-hidden` so this is not a conformance failure, but a rank nobody can read is
not a rank.

---

## 3 · Design

### 3.1 The brand lockup is printed twice in the masthead

`BrandBanner` is an inline SVG containing the words **"EkJhalak"** and
**"एक झलक"**. It sits roughly 400px to the left of the `<h1>`, which says
**"EkJhalak"** and **"एक झलक"**. Same two words, twice, at two sizes, on one
line of one masthead.

The banner's own docstring explains it is `aria-hidden` "because the `<h1>`
wordmark immediately beside it already carries the same two names as text" —
which identifies the redundancy precisely and then keeps it visually. A nameplate
that prints the paper's name twice reads as a mistake, not as a device.

The mark *above* the lockup (range, dispatches, globe) is good and worth keeping.
The geometry is correct — the globe's latitude lines are drawn to the exact
half-widths of the sphere at each y. It is the duplicated wordmark below it that
should go.

### 3.2 The story reader renders at 384px instead of 672px

`StoryReader` asks for `sm:max-w-2xl`. `SheetContent` ships
`data-[side=right]:sm:max-w-sm`. Compiled:

```css
.sm\:max-w-2xl                                        { max-width: 42rem }  /* (0,1,0) */
.data-\[side\=right\]\:sm\:max-w-sm[data-side=right]  { max-width: 24rem }  /* (0,2,0) */
```

The attribute selector wins on specificity, and it also appears later in the
sheet. Measured at runtime: `getComputedStyle(panel).maxWidth === "384px"`.

The component that documents itself as "a reading surface, not a preview:
generous measure, large type" is a 384px column. The 3.25rem drop cap sits in a
five-word measure and the "Read at source" button wraps onto two lines.

### 3.3 430px of chrome before the first story — 35% of the first screen

Ticker (36) + utility row (41) + nameplate (152) + topic rail (44) + region rail
(44) + page padding. On a 1230px-tall viewport the lead story starts at y=430; on
a 800px laptop that is **54% of the fold** spent on furniture before any news.
The nameplate alone is 152px.

### 3.4 Grey-topic cover art disappears in dark mode

**243 of 475 stories (51%) ship no photograph**, so half the grid is generated
`.cover-art`. Four of the eleven topics (culture, technology, society, opinion)
are greys. A grey at 30% over `--raised` `#1e1e21` produces a plate nearly
indistinguishable from the card it sits on, and the `--pitch` glyph at 0.42
opacity on top of it is barely visible.

The CSS comment states this was already fixed by mixing from `--raised` instead
of black. It was improved, not fixed — observed live, the "society" card renders
as a flat dark rectangle that reads as a broken image.

---

## 4 · Content quality

### 4.1 78 of 475 cards (16.4%) show no usable summary

| defect | count | sources |
|---|---|---|
| summary repeats the headline verbatim | 52 | mixed |
| summary is publisher boilerplate | 26 | The Hindu ×20, Guardian ×4, BBC ×2 |

Live sample, rendered as a news summary on the card:

> "Account subscription benefits alongside Premium Stories, Editorials, Opinions
> and more. Unlock these with Subscription Published - July 31, 2026 10:30…"

`extractBestDescription()` picks the *longest* candidate field, which for The
Hindu is the paywall pitch. `isSummaryAcceptable()` only checks length — 160–480
chars — so boilerplate passes and is never sent to the summarizer for a rewrite.

### 4.2 Five of 41 sources are dead

| source | status |
|---|---|
| My Republica | HTTP 403 |
| The Himalayan Times | HTTP 404 |
| Setopati English | HTTP 500 |
| Times of India | fetch failed |
| CNN | fetch failed |

Three are core Nepali outlets — the product's home market. The footer reports
"Reading from *N* newsrooms" using the live count, so it silently says 36.

---

## 5 · Performance

### 5.1 The homepage ships 477 stories to render 30

Measured from the production build:

| artifact | size |
|---|---|
| prerendered `index.html` | **697 KB** (163 KB gzip) |
| RSC flight payload | **587 KB** |
| client JS | 805 KB raw / 240 KB gzip |

`page.tsx` passes the entire feed as props to `NewsFeed`, a client component. All
477 items are serialized into the flight payload for hydration. The first paint
renders 1 hero + 3 side + 12 grid + 6 trending + 8 ticker ≈ **30 stories**. The
other ~447 are downloaded by every visitor to support client-side filtering they
may never touch.

Four fields are serialized per item and read by **no component**:
`sourceHomepage`, `category`, `credibility`, `sourceId` (`sourceId` is used by
ranking, server-side only).

### 5.2 `/api/news` returns 441 KB, uncached, every 3 minutes per tab

`REFRESH_INTERVAL_MS = 3 * 60 * 1000`, `limit=500`, `cache: "no-store"`, and the
route sets no `Cache-Control`. Every open tab pulls 441 KB from a serverless
function every three minutes. Ten concurrent readers for an hour is ~880 MB of
function egress for data that changes at most every 5 minutes (the
`unstable_cache` revalidate window).

### 5.3 The feed replaces itself underneath the reader

Observed live: with the story panel open, the 3-minute refresh fired and every
card behind it changed. `setItems()` re-runs all ranking, so the hero, the grid,
the trending rail and the current page contents all shift while the reader is
reading. Pagination silently jumps to different stories.

---

## 6 · SEO

### 6.1 Stories have no URLs

Every story opens in a sheet with no route change. There is no deep link, no
share target, no back-button behaviour, and `sitemap.xml` contains exactly one
URL. For a news product this is the largest single SEO constraint.

**Not fixed here — this is a product decision, not a defect.** Creating indexable
pages from other publishers' summaries changes the site's legal posture from
"aggregator that links out" to "republisher," which the footer disclaimer and the
`readFull` → source-first design deliberately avoid. What *is* safe and worth
doing is a shareable deep link (`/?story=<id>`) that opens the panel on load
while keeping the canonical URL and `noindex` semantics intact. Recommended,
scoped, and left for a decision.

### 6.2 `lib/seo/structured-data.ts` is dead code with a conflicting brand

70 lines, **zero importers**. It also declares a different brand name —
`"EJKN | EkJhalak News"` — and a different description ("Vibrant bilingual news
briefings") than `layout.tsx` ("Calm bilingual news briefings"). If it were ever
wired up it would contradict the live metadata.

### 6.3 `.env.example` documents infrastructure that does not exist

`DATABASE_URL`, `SUPABASE_*`, `INGEST_HMAC_SECRET` and "`/api/admin/*` endpoints"
are all documented; none exist in this repo. CI passes `INGEST_HMAC_SECRET` as a
build stub for nothing.

---

## 7 · What is already right

Worth stating, because a list of faults misrepresents the codebase:

- Theme is set by an inline pre-paint script — no flash, correctly done.
- `FeedClockProvider` anchoring relative time to `fetchedAt` rather than
  `Date.now()` is the correct fix for hydration drift, and the comment explains why.
- `prefers-reduced-motion` and `scripting: none` fallbacks for the reveal
  animation and ticker — genuinely thorough.
- Body text contrast passes comfortably in both themes (5.44–18.2:1).
- The security header set in `next.config.ts` is complete and correct.
- `/api/subscribe` refusing to fake a subscription when no provider is configured
  is the honest choice, and rare.
- `diversifyBySource` and the per-source cap in `selectTrending` solve a real
  editorial problem that most aggregators ignore.

---

## Remediation status

| # | Finding | Severity | Status |
|---|---|---|---|
| 1.1 | `coverageCount` always 1 | Critical | **Fixed** |
| 1.2 | Cron targets missing route | Critical | **Fixed** |
| 1.3 | `/api/revalidate` fails open | Critical | **Fixed** |
| 1.4 | `pnpm-workspace.yaml` placeholder | Critical | **Fixed** |
| 1.5 | Three lockfiles / CI mismatch | High | **Fixed** |
| 2.1 | Dark solid pills fail WCAG | Critical | **Fixed** |
| 2.1b | Quiet pills fail on their own wash | High | **Fixed** |
| 2.2 | No keyboard focus on stories | Critical | **Fixed** |
| 2.3 | Red CTA fails WCAG in dark | High | **Fixed** |
| 2.4 | Rank numerals invisible | Low | **Fixed** |
| 3.1 | Brand lockup printed twice | High | **Fixed** |
| 3.2 | Reader panel 384px not 672px | High | **Fixed** |
| 3.3 | 430px of chrome before content | Medium | **Fixed** |
| 3.4 | Grey cover art invisible in dark | Medium | **Fixed** |
| 4.1 | 16.4% of cards lack a summary | High | **Fixed** |
| 4.2 | Five dead sources | Medium | **Fixed** |
| 5.1 | 477 stories shipped to render 30 | Critical | **Fixed** |
| 5.2 | `/api/news` uncached at 441 KB | High | **Fixed** |
| 5.3 | Feed shifts under the reader | Medium | **Fixed** |
| 6.1 | Stories have no URLs | High | **Deferred — product decision** |
| 6.2 | Dead `structured-data.ts` | Low | **Fixed** |
| 6.3 | `.env.example` fiction | Low | **Fixed** |

---

## Post-fix verification

Every figure below was measured against the rebuilt production bundle and a live
`next start` server, not estimated.

### Payload

| | before | after | |
|---|---|---|---|
| prerendered `index.html` | 697,919 B | **312,024 B** | −56% |
| gzipped | 162,886 B | **70,925 B** | −57% |
| RSC flight payload | 587,000 B | **218,531 B** | −63% |
| stories serialized | 477 | **180** | |
| `/api/news` response | 441 KB | **153 KB** | −65% |

### Content quality (live feed, 180 items)

| | before | after |
|---|---|---|
| summary repeats the headline | 52 | **0** |
| summary is publisher boilerplate | 26 | **0** |
| stories with coverage from >1 outlet | **0 of 475** | **8 of 180** (max 3) |
| dead sources | 5 | **1** (Times of India — see below) |
| usable summaries | — | 173 of 180; 7 render headline-only |

`coverageCount` moving off 1 is the single most important line in this table: it
is the first time the trending rail's stated ranking signal has had any data in
it, and "3 OUTLETS COVERING" now renders on the hero.

### Accessibility

| | before | after |
|---|---|---|
| solid topic pills, dark | 1.73–4.09:1, **11 fail** | **4.83–11.43:1, all pass** |
| quiet topic pills, both themes | 3.94–8.15:1, **6 fail** | **4.54–8.15:1, all pass** |
| white on the red CTA, dark | 3.91:1 | **4.74:1** |
| trending rank numerals, dark | 1.63:1 | **5.44:1** |
| story cards with a visible focus ring | **0 of 22** | **22 of 22** |
| total pairings checked | — | **62, all pass** |

Enforced by `pnpm run check:contrast`, wired into `pnpm verify` and CI.

### Layout

| | before | after |
|---|---|---|
| story reader panel | 384px | **672px** |
| chrome above the lead story | 430px (35% of first screen) | **362px (31%)** |
| brand lockup appearances in the masthead | 2 | **1** |

### Security and infrastructure

| check | result |
|---|---|
| `/api/news` `Cache-Control` | `public, s-maxage=300, stale-while-revalidate=600` |
| `POST /api/revalidate`, no secret, production | **401** (was 200 — open to anyone) |
| `GET /api/revalidate`, no secret, production | **401** (was 405 — no handler existed) |
| `GET /api/revalidate`, correct `CRON_SECRET` bearer | 200 |
| `GET /api/revalidate`, wrong bearer | 401 |
| cron path resolves to a real route | yes — `/api/revalidate` |
| lockfiles in the repo | **1** (was 3) |
| `pnpm install` | **succeeds** (was `ERR_PNPM_IGNORED_BUILDS`) |

### Gate

`pnpm run verify` — lint → typecheck → contrast → build — passes clean.

---

## Notes on judgement calls

Two places where I deliberately did **not** do the obvious thing:

**Times of India was left active.** Its feed reported `fetch failed`, which looks
identical to the four sources I retired. But the entire `indiatimes.com` domain —
homepage included — timed out from the auditing machine while every other source
resolved normally. That is an egress restriction on this host, not evidence the
feed is gone. Disabling a working source on that evidence is the worse error, so
it stays enabled with the reasoning recorded in its registry note. Check
`sourceStatuses` from a production deploy to settle it.

**Per-story URLs were not added.** This is the largest SEO constraint on the site
and the fix is not hard, but it is a product decision rather than a defect:
publishing indexable pages built from other publishers' summaries moves the site
from "aggregator that links out" to "republisher," which the footer disclaimer
and the source-first reader design deliberately avoid. The safe subset — a
shareable `/?story=<id>` deep link that opens the panel on load without becoming
an indexable document — is recommended and scoped in §6.1, and left for a call.
