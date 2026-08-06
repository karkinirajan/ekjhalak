# Phase 9 — Final re-verification

Every Phase 1 command re-run against production, same tooling, same target:
Lighthouse 13.4.1 headless with simulated throttling, axe-core 4.12.1 over the
hydrated page, `https://ekjhalak.news`.

Baseline was deploy `4615baa`. Final is `c102314`.

Mobile Lighthouse was run **three times** and desktop twice; the figures below are
medians and the raw JSON kept here is the median-LCP run. One run is not a
measurement — the spread is reported rather than the best number.

---

## The gate

Phase 9 requires no regression on LCP, CLS, axe critical/serious count, Best
Practices score, or sitemap URL count.

| Metric | Baseline | Target | Final | |
| --- | --- | --- | --- | --- |
| Mobile LCP | 19.6 s | < 2.5 s | **3.0 s** | improved 85%, target missed |
| Mobile CLS | 0.000 | ≤ 0.1 | **0.000** | held |
| Desktop CLS | 0.002 | ≤ 0.1 | **0.005** | +0.003, both effectively zero |
| axe critical + serious | 1 serious | 0 | **0** | met |
| Best Practices (both) | 96 | ≥ 95 | **100** | met |
| sitemap.xml URLs | 6 | > 6 | **465** | met |

**No regressions.** The desktop CLS moved from 0.002 to 0.005 — a twentieth of
the 0.1 budget, and inside the run-to-run noise of a page whose mobile CLS is a
flat zero across three runs. It is recorded rather than rounded to "unchanged".

**One target is still missed and is not being written off as future work.**
Mobile LCP is 3.0 s median against a 2.5 s target, with runs at 3.0 / 2.8 / 4.1 s.
What remains is main-thread, not network: on a slow run every request completes
roughly three seconds before LCP is recorded, and TBT is 22 ms, so it is neither
bandwidth nor a long task. The next thing to look at is the post-hydration
re-render that repaints the above-the-fold area. Three network-side theories were
tested and measured during Phase 4; the fourth deserves the same treatment rather
than a guess.

---

## Full comparison

| | Mobile before | Mobile after | Desktop before | Desktop after |
| --- | --- | --- | --- | --- |
| **Performance** | 67 | **94** | 77 | **100** |
| **Accessibility** | 97 | **100** | 97 | **100** |
| **Best practices** | 96 | **100** | 96 | **100** |
| **SEO** | 100 | 100 | 100 | 100 |
| LCP | 19.6 s | 3.0 s | 4.3 s | 0.8 s |
| FCP | 2.7 s | 1.3 s | 0.9 s | 0.4 s |
| CLS | 0 | 0 | 0.002 | 0.005 |
| TBT | 63 ms | 22 ms | 0 ms | 0 ms |
| Speed Index | 5.0 s | 1.4 s | 1.0 s | 0.6 s |
| **Total bytes** | 3,444 KiB | **705 KiB** | 4,744 KiB | **957 KiB** |

Every Lighthouse category is at 100 on desktop, and three of four on mobile.

## Accessibility

axe-core across the full Phase 1 URL set:

```
/                       0 violations
/about                  0
/editorial-standards    0
/privacy                0
/terms                  0
/contact                0
```

Zero at **any** severity, not merely zero critical/serious. The baseline's
`color-contrast` (serious, 6 nodes) and `landmark-unique` (moderate) are both
closed. A keyboard pass was run in a real browser: 163 focusable stops, no
positive `tabindex`, working skip link, every input named, and a visible focus
ring confirmed by screenshot.

## SEO

```
sitemap.xml            465 URLs   (was 6 — no article was individually indexable)
news-sitemap.xml       433 entries, Google News extension, 48-hour window
NewsArticle JSON-LD    present, every required property well-formed
unknown permalink      real 404, not a soft one
canonical host         465/465 <loc> on the apex
```

## Feed quality

Not part of the original Phase 1 baseline — added because the defects it catches
all shipped past a green test suite.

```
markup / entities / markdown in reader-facing text   0
image coverage                                       up to 89% (was 49%)
summaries under 100 chars                            0%
anything over the 400-char display cap               0
duplicate ids, missing fields, relative URLs         0
```

## Reproduce

```bash
pnpm verify        # lint, typecheck, 52 tests, contrast, build
pnpm verify:live   # feed quality -> axe -> SEO, against production

CHROME_PATH=$(which google-chrome-stable) npx lighthouse https://ekjhalak.news/ \
  --quiet --output=json --output-path=audit/final/lighthouse-mobile.json \
  --form-factor=mobile --screenEmulation.mobile \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu"
```

Run Lighthouse three times. The mobile spread is wide enough that a single run
will mislead you.
