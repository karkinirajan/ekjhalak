# Phase 1 — Performance and accessibility baseline

Measured against **production**, 2026-08-06, on deploy `4615baa`. Raw JSON in this
directory; every number below is reproducible from it.

- Lighthouse 13.4.1, headless Chrome, simulated throttling, one run per form factor
- axe-core 4.12.1, driven over CDP against the fully hydrated page (12s settle)

Target host is the **apex**, `https://ekjhalak.news`. `www.ekjhalak.news` — the host
in `NEXT_PUBLIC_SITE_URL`, and therefore in every canonical tag, OG URL and sitemap
entry — 301s to it. See D2 in `../recon.md`; the redirect is measured separately
below rather than folded into these scores.

---

## Lighthouse

| Category | Mobile | Desktop |
| --- | --- | --- |
| Performance | **67** | **77** |
| Accessibility | 97 | 97 |
| Best practices | 96 | 96 |
| SEO | 100 | 100 |

### Core Web Vitals and lab metrics

| Metric | Mobile | Desktop | Good |
| --- | --- | --- | --- |
| **LCP** | **19.6 s** | **4.3 s** | ≤ 2.5 s |
| FCP | 2.7 s | 0.9 s | ≤ 1.8 s |
| **CLS** | **0** | **0.002** | ≤ 0.1 |
| **TBT** | **60 ms** | **0 ms** | ≤ 200 ms |
| Speed Index | 5.0 s | 1.0 s | ≤ 3.4 s |
| Time to Interactive | 19.7 s | 4.3 s | — |
| Server response (root doc) | 610 ms | 80 ms | ≤ 600 ms |

Lighthouse is a lab tool and reports TBT, not INP; INP needs field data, which this
site does not yet collect. TBT is the stand-in, and it is already comfortable — the
JavaScript is not the problem here.

**CLS of 0 and TBT of 60 ms are genuinely good and worth protecting.** Two of the
three vitals are already where they need to be. The performance score is being held
down almost entirely by one number.

### That one number

LCP is a hero `<img>` in the lead card, and it is doing everything right except its
source:

```
element  div.reveal > article.group > div.aspect-16/10 > img.object-cover
         loading="eager"  fetchpriority="high"  discoverable in the initial document
source   https://www.dcnepal.com/wp-content/uploads/2026/08/RS_KTMRATL4488.jpg
size     2,408,524 bytes — displayed at 378 × 236 CSS px
```

**2.4 MB for a thumbnail.** Lighthouse puts 2,354 KB of the 2,382 KB image-delivery
saving on this single file. The image is hotlinked straight from the publisher's
WordPress origin, at whatever dimensions and format they uploaded, unresized and
unconverted, and not through `next/image` — so nothing in this codebase gets a say
in what a reader downloads.

Resource weight, mobile / desktop:

| Type | Mobile | Desktop |
| --- | --- | --- |
| Image (all third-party) | 3 req · **2,497 KiB** | 7 req · **3,797 KiB** |
| Font | 13 req · 540 KiB | 13 req · 540 KiB |
| Script | 12 req · 208 KiB | 12 req · 208 KiB |
| Document | 1 req · 185 KiB | 1 req · 185 KiB |
| Stylesheet | 1 req · 13 KiB | 1 req · 13 KiB |
| **Total** | 32 req · **3,444 KiB** | 36 req · **4,744 KiB** |

Every image byte on the page is third-party. Desktop loads *more* image weight than
mobile because more cards are above the fold, which is why its LCP is 4.3 s rather
than 2.5 s despite the far faster connection.

**13 font requests for 540 KiB** is the second-largest line and the one fully inside
this repo's control. It was flagged as unverified during Phase 0 recon; it is now
measured.

Other Lighthouse findings, all an order of magnitude smaller:

| Insight | Est. saving |
| --- | --- |
| Improve image delivery | 2,382 KiB |
| Use efficient cache lifetimes | 1,082 KiB |
| Document request latency | 510 ms |
| Reduce unused JavaScript | 43 KiB |
| Avoid legacy JavaScript | 13 KiB |

---

## axe-core

| Page | Violations | critical | serious | moderate | minor |
| --- | --- | --- | --- | --- | --- |
| `/` | **2** | 0 | 1 | 1 | 0 |
| `/about` | 0 | 0 | 0 | 0 | 0 |
| `/editorial-standards` | 0 | 0 | 0 | 0 | 0 |
| `/subscribe/confirmed` | 0 | 0 | 0 | 0 | 0 |

No critical violations anywhere. Both findings are on the home page.

**`color-contrast` — serious, 6 nodes.** Every instance is an `opacity-*` utility
applied to text that passes at full opacity:

```
.eyebrow.opacity-90              "16:41 NPT"
.ml-1\.5.opacity-55 (×5)         section story counts — "124"
```

`opacity-55` on a muted foreground is the recurring one. Worth noting that
`scripts/check-contrast.mjs` passes: it checks the token pairs as authored, and
these ratios are only broken at render time by a utility applied on top. The script
cannot see this class of failure, which is a gap in the check as much as in the CSS.

**`landmark-unique` — moderate, 1 node.** `<nav aria-label="Sections">` shares its
role/name shape with another landmark on the page. One of the two needs a
distinguishing accessible name.

---

## Redirect cost

Measured separately, since it applies to every reader who arrives on the canonical
hostname:

```
https://www.ekjhalak.news/...   HTTP=301   0.23 s   →   https://ekjhalak.news/...
```

A fifth of a second, ahead of any content, on the host this site tells search
engines and social crawlers to use.

---

## What this baseline says

Three of the four Lighthouse categories are at or near ceiling, CLS is zero, and
TBT is 60 ms. The site is not broadly slow — it is fast, with one 2.4 MB image in
front of it. The single highest-value change available is putting publisher images
behind an image pipeline that resizes and re-encodes them; nothing else on this
page is within an order of magnitude of it.

Re-run the exact commands in `../recon.md`'s command reference against this
directory to compare after any change.
