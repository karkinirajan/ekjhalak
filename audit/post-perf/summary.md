# Phase 4 — Performance remediation, measured

Same commands as Phase 1, same target, so the two are directly comparable:
Lighthouse 13.4.1, headless Chrome, simulated throttling, `https://ekjhalak.news/`.
Baseline was deploy `4615baa`; this is `0680629`.

Mobile was run **three times**, because a single run turned out not to be
trustworthy — see "What the spread means" below. The JSON kept here is the
median-LCP run of the three.

---

## Headline

| | Mobile | Desktop |
| --- | --- | --- |
| Performance | 67 → **86** (86 / 86 / 96 across runs) | 77 → **99** |
| Accessibility | 97 → 97 | 97 → 97 |
| Best practices | 96 → **100** | 96 → **100** |
| SEO | 100 → 100 | 100 → 100 |

| Metric | Mobile before | Mobile after | Desktop before | Desktop after |
| --- | --- | --- | --- | --- |
| **LCP** | 19.6 s | **4.2 s** (2.7–4.2) | 4.3 s | **0.9 s** |
| FCP | 2.7 s | 1.5 s | 0.9 s | 0.3 s |
| **CLS** | 0 | **0.000** | 0.002 | **0.003** |
| **TBT** | 60 ms | **21 ms** | 0 ms | 0 ms |
| Speed Index | 5.0 s | 1.9 s | 1.0 s | 0.5 s |
| Total bytes | 3,444 KiB | **767 KiB** | 4,744 KiB | **846 KiB** |

### Against the gate

- **CLS ≤ 0.1 — met.** 0.000 on mobile across all three runs, 0.003 desktop.
- **Mobile LCP under 2.5 s — not met.** 19.6 s → 2.7 s at best, 4.2 s median. That
  is a 78–86% reduction and it clears the "drop meaningfully" bar, but the stated
  target is missed and the reason is recorded below rather than rounded away.

---

## Where the bytes went

| Type | Mobile before | Mobile after | Desktop before | Desktop after |
| --- | --- | --- | --- | --- |
| Image | 3 req · 2,497 KiB | 5 req · **160 KiB** | 7 req · 3,797 KiB | 16 req · **284 KiB** |
| Font | 13 req · 540 KiB | 9 req · **382 KiB** | 13 req · 540 KiB | 9 req · **381 KiB** |
| Document | 1 req · 185 KiB | 1 req · **39 KiB** | 1 req · 185 KiB | 1 req · **40 KiB** |
| Script | 12 req · 208 KiB | 11 req · 211 KiB | 12 req · 208 KiB | 11 req · 211 KiB |
| **Third-party** | 3 req · 2,497 KiB | **0 req · 0 KiB** | 7 req · 3,797 KiB | **0 req · 0 KiB** |

Every image byte used to come straight from a publisher's origin at whatever size
they uploaded. Now none does.

Lighthouse's image-delivery saving went from **2,382 KiB to 16 KiB** — the
opportunity is closed, not merely reduced.

---

## The four changes, and what each bought

**1. Publisher images through the optimizer.** `story-image.tsx` used a raw `<img>`
for a real reason: `next/image` throws on a host missing from `remotePatterns`, so
using it unconditionally means a new source renders broken cards until someone
edits a config file. `lib/image-hosts.ts` is now one allowlist read by both
`next.config.ts` and the component, and the component asks it at render time —
listed host gets `next/image` with a `sizes` matching the frame; unlisted host
gets the same plain `<img>` as before. Optimization became what a new source
*gains*, not what it needs to avoid being broken.

Three of the eight image hosts in a live feed were unlisted, including the two
heaviest: `npcdn.ratopati.com` and `www.dcnepal.com` — the latter serving the
2.4 MB baseline LCP element.

**2. The reveal animation was hiding the fold.** This was the single largest win
and it was not a network problem at all. `.reveal` sets `opacity: 0` in the
server-rendered HTML and only lifts it when an IntersectionObserver fires, so the
lead cards were invisible until the bundle downloaded, hydrated, ran the observer
and finished a 600 ms transition. The LCP image finished downloading at 1.4 s and
LCP was recorded at 6.0 s. `Reveal` now takes `immediate` for the cards that are
above the fold on arrival — the same ones whose images are preloaded, since it is
the same question. **6.0 s → 3.3 s.**

**3. The first response carries 60 stories, not 456.** `FEED_PAGE_LIMIT` was 1500
against a doc comment arguing for 180; one number cannot be both the pool the
client filters over and the payload the document ships. Split in two:
`FEED_SSR_LIMIT` (60) renders a complete page — hero, side rail, and the grid's
first 12 — and the rest is fetched when a reader reaches for a filter or pages
past it. Document: **185 KiB → 39 KiB.**

Getting the *timing* of that fetch right took three attempts, all measured:

| When the rest is fetched | Mobile LCP |
| --- | --- |
| On mount | 5.9 s |
| On idle (`requestIdleCallback`, 3 s ceiling) | 3.9 s |
| **Only when a reader asks** | **2.6 s** |

Scheduling was never the issue. Taking `items` from 60 to 456 re-runs every
ranking selection and can change the hero and the grid, and LCP is measured
against the last such paint — so the only version that leaves LCP alone is the one
that does not fetch until the reader needs it. It also stops spending 152 KiB on
someone who never leaves "Today".

**4. Fonts.** 13 preloads for 540 KiB, contending with the lead image for the
first second of a throttled connection. Merriweather 300/900 and Mukta 300 were
declared and unreachable — every `font-black` in the codebase sits on a
`font-display` element, so Merriweather 900 was a file downloaded to render
nothing. Merriweather and JetBrains Mono dropped `preload`; Mukta 500 was dropped
outright, since it is reached only by `.eyebrow` and CSS weight matching resolves
a missing 500 down to 400 without synthesizing. **13 requests → 9, 540 → 382 KiB.**

Mukta 400/600/700 all stay preloaded, and that is a deliberate refusal to trade
further. Devanagari has no dependable system fallback, and synthesized bold pulls
conjuncts apart — the exact failure Mukta was chosen to avoid. Roughly 195 KiB of
the remaining 382 KiB is Devanagari, and it is the largest single thing still on
the critical path. Cutting it would buy some of the missing LCP at the cost of how
Nepali renders, which is a product decision and not one to make inside a
performance pass.

**Also removed:** `@vercel/speed-insights`. Its script 404s on this deployment —
verified — and `connect-src 'self'` would block the beacon regardless, so it was a
failed request on every page load for telemetry Vercel could never receive.

---

## What the spread means, and what is left

Mobile LCP came in at 2.7 s, 4.2 s and 4.2 s on three consecutive runs against the
same deploy. That is not noise around a single number, and the waterfalls say why —
**the remaining LCP is not network-bound**:

```
slow run (LCP 4.21 s):  27 requests, last ends 1.14 s, all images done by 0.62 s
fast run (LCP 2.68 s):  30 requests, last ends 2.30 s, images at 1.03–2.07 s
```

The slow run finishes loading everything three seconds before LCP is recorded, and
the fast run loads *longer* while painting *sooner*. Whatever sets LCP now happens
on the main thread after hydration, not on the wire. TBT is 21 ms, so it is not a
long task either — more likely a post-hydration re-render that repaints the
above-the-fold area.

That is the next thing to look at, and it is deliberately not guessed at here.
Three network-side theories were tested and measured during this phase; the fourth
should be too.

Reproduce with:

```bash
CHROME_PATH=$(which google-chrome-stable) npx lighthouse https://ekjhalak.news/ \
  --quiet --output=json --output-path=audit/post-perf/lighthouse-mobile.json \
  --form-factor=mobile --screenEmulation.mobile \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu"
```

Run it three times. One run is not a measurement.
