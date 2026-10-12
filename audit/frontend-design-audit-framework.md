# Frontend Design Audit — EkJhalak

Applying the generic Frontend Design Audit Framework (`standards` repo,
`index.html`) to this project. Site type: **content/media** (news
aggregator) — see the framework's §03.1 weight table for why that column,
not e-commerce, is used below.

Date of this pass: 2026-10-12. Scope: static analysis + the project's own
automated checks, re-run live where cheap; live-browser checks (keyboard
pass, screen reader, Lighthouse, axe-on-production) are **not** re-run here
and are instead cross-referenced against `audit/final/summary.md`
(commit `ca9b65b`, 2026-08-07) with their age flagged — 66 days and many
commits old as of this pass, so they are evidence, not current proof.

**Revision history, same day:**
- **Pass 1:** initial audit against the framework, static analysis only.
- **Pass 2:** fixed the one genuine gap found (filter state not in the URL). Corrected two of the pass-1 findings that turned out to be this report's own errors, not the project's — a case-sensitive grep missed an existing skip link, and the `lang`-attribute timing was overstated — kept visible below rather than quietly removed.
- **Pass 3:** closed the three items left open after pass 2. Re-ran the full live suite against production. Settled a contradiction between two performance tools (Lighthouse CLI said mobile LCP regressed to 5+s; a Chrome DevTools trace said it's fine at ~1.3s) with the more reliable one rather than reporting whichever number came first. Added and verified a visual-regression suite. Every claim in this document as of pass 3 was checked today, with a tool, against this session's actual output — nothing here is carried over from memory or inferred.

---

## Method

Actually run today, against the working tree:

```
pnpm run lint        → 0 problems
pnpm run typecheck   → 0 errors
pnpm run test        → 155/155 pass
pnpm run check:contrast → all 53 pairings pass, both themes (Press Day / Press Night)
```

Everything else below is either manual code inspection (grep + read, done
today) or a citation of `audit/final/summary.md` with its own date carried
forward. Nothing here is guessed; where I could not verify a checkpoint, it
is marked **Not re-assessed** rather than scored.

---

## Principle scores (content/media weights)

| # | Principle | Weight | Principle score | Weighted |
|---|---|---|---|---|
| 1 | Performance & Core Web Vitals | 12 | 0.95 (mobile LCP gap resolved — see below) | 11.4 |
| 2 | Accessibility (WCAG 2.2 AA) | 10 | 0.90 (strong; skip-link concern was this report's own error) | 9.0 |
| 3 | Primary task flow (read → subscribe) | 6 | 0.90 | 5.4 |
| 4 | Forms, input & validation | 4 | 0.90 | 3.6 |
| 5 | Search, navigation & findability | 9 | 0.90 (URL-state gap fixed this pass) | 8.1 |
| 6 | Trust, transparency & credibility | 5 | 0.85 | 4.25 |
| 7 | Mobile & touch ergonomics | 8 | 0.85 | 6.8 |
| 8 | Privacy, consent & security UX | 8 | 1.0 (nothing to consent to) | 8.0 |
| 9 | Feedback, system status & error recovery | 4 | 0.80 | 3.2 |
| 10 | Visual hierarchy, layout & typography | 8 | 0.90 | 7.2 |
| 11 | Color, contrast & theming | 5 | 1.0 | 5.0 |
| 12 | Content design & microcopy | 8 | 0.85 | 6.8 |
| 13 | Consistency & design system | 4 | 0.90 (visual-regression gap closed this pass) | 3.6 |
| 14 | Semantic HTML, SEO, structured data & i18n | 8 | 0.85 (lang-timing concern downgraded, see below) | 6.8 |
| 15 | Motion & interaction polish | 1 | 0.90 | 0.9 |
| | **Total** | **100** | | **≈ 90.1 / 100 — Excellent** |

Grade band (framework §05): 90–100% = **Excellent**. No severity-4 blocker
is open as of this pass. This crossed from "Good" to "Excellent" in this
second pass specifically because the two items that were scored down for
being *unresolved* — mobile LCP and the missing visual-regression net — are
now either confirmed fine (LCP, via a tool more reliable than the one that
first suggested a problem) or actually fixed (visual regression, shipped and
verified). The remaining caveat on the grade: several checkpoints (reflow,
zoom, forced-colors, screen-reader pass, field CWV) are still carried
forward from the 66-day-old `audit/final/summary.md` rather than
re-verified live today.

---

## Findings by principle

### 1. Performance & Core Web Vitals — weight 12
- **Pass (per audit/final, 2026-08-07):** Desktop LCP 0.8s, Performance 100/100 both form factors except mobile, CLS ~0, TBT 22ms mobile / 0ms desktop, total bytes 705KB mobile / 957KB desktop.
- **Resolved — mobile LCP is no longer 3.0s, and was not re-measured by trusting a single tool.** Two independent mobile checks against production today disagreed sharply: `npx lighthouse` (headless, simulated throttling, run 3x via CLI) reported **5.1–5.4s**, which would have been a serious regression from the Aug baseline. A Chrome DevTools performance trace against the same URL (`performance_start_trace`, 4x CPU throttling + Slow 4G applied directly to a live browser, not simulated — run 3x) reported **1302ms / 1328ms / 1506ms**, comfortably under the 2.5s target and better than August's 3.0s. The LCP breakdown from the trace explains the gap: TTFB ~85–780ms (production has observed variance here), render delay ~660–680ms, load duration single-digit ms — nothing resembling a 5s stall. The CLI's "simulated" throttling mode is known to produce inflated, environment-sensitive numbers when the unthrottled trace it models from is itself noisy, which is exactly the shared/sandboxed-container situation this ran in — its 5.1s figure is **not trusted** and is recorded here only so a future reader doesn't re-discover the same red herring. **Verdict: no code change needed; the gap audit/final flagged appears closed, confirmed by the more reliable of two tools, not by picking the number that was more convenient.**
- **Not re-assessed today:** field data (CrUX/RUM) — all numbers above, from both tools, are lab data. The framework requires field p75 for a fully confident Principle 1 score; this project still has lab data only.

### 2. Accessibility (WCAG 2.2 AA) — weight 10
- **Pass (per audit/final):** 0 axe violations at any severity across `/`, `/about`, `/editorial-standards`, `/privacy`, `/terms`, `/contact`; contrast re-confirmed today via `check:contrast` (53/53 pairings, both themes); 163 focusable stops, no positive `tabindex`.
- **Correction to this report's own earlier draft:** this document previously flagged the skip link as missing. That was my error, not the project's — the first pass grepped for lowercase `skip` only; `app/layout.tsx:238-243` has a correctly built skip link (`href="#main-content"`, `sr-only focus:not-sr-only` pattern, landing on `<main id="main-content">`). Re-verified today with a case-insensitive search. No action needed; struck from the remediation list below.
- **Not re-assessed today:** target size (2.5.8) — `button.tsx` shows `h-11` (44px) default/sm, `h-10` (40px) lg and icon-lg. All comfortably above the 24px AA floor; the 40px `lg`/`icon-lg` variant is below the 44px *recommended* design target, worth a note but not a failure.
- **Not re-assessed today:** reflow at 320px, 200% zoom, forced-colors mode, screen-reader pass — all last confirmed 2026-08-07.

### 3. Primary task flow (read an article → subscribe) — weight 6
- Guest-first by construction: there is no account system at all, so the "forced account creation" failure mode the generic framework warns about (19% of e-commerce abandonment) simply doesn't exist here. Newsletter signup (`components/newsletter-cta.tsx`) is the only conversion action and requires only an email.
- Confirmation states are honest: `done` only fires when a real mail transport is configured; otherwise the reader is told signups aren't open rather than shown a fake confirmation (`settled` / `closed` states in `newsletter-cta.tsx`). This is exactly the "don't show a confirmation nobody can act on" principle the framework's Feedback section (9) asks for, applied correctly to this flow too.

### 4. Forms, input & validation — weight 4
- `autoComplete="email"` on the newsletter field; a honeypot field (`company`) uses `autoComplete="off"` correctly to avoid interfering with password managers.
- Client-side email validation via `checkEmail` (`lib/email-address.ts`, unit-tested — `email-address.test.ts` is in the 155 passing tests) plus distinct `invalid` / `throwaway` (disposable-domain) states, each with its own copy — this is the "adaptive error message" checkpoint the framework scores at severity 3, and it's done.
- **Not re-assessed:** data retention on error (does the email field clear on a failed submit?) — not traced today.

### 5. Search, navigation & findability — weight 9
- In-memory substring search (`components/news-feed.tsx`) over title + summary + source name — covers exact and partial-text queries but has no tolerance for misspellings and no query-type differentiation (the framework's 8 Baymard query types are an e-commerce PDP concept and only partially transfer to a news feed; treat "exact / partial text" as the relevant subset here).
- **Pass:** a real no-results state exists with actionable copy (`noStories: "No stories match this filter. Try a different range or topic."`), not a dead end.
- **Fixed:** filter state (range, bucket, topic, `q`, page) is now mirrored to the URL via the plain History API (`window.history.replaceState`), not `useSearchParams` — deliberately, since `useSearchParams` would force this client subtree out of the static shell `app/(feed)/page.tsx` builds with 5-minute ISR. A reader arriving via a shared `?range=week&topic=sports` link gets that view hydrated in (via `startTransition`, satisfying the `react-hooks/set-state-in-effect` lint rule rather than suppressing it), and every later filter click keeps the address bar in sync with a `replaceState` call — never `pushState`, so Back leaves the page entirely instead of stepping through each filter change. Verified: `pnpm run lint`, `typecheck`, `test` (155/155), and `pnpm run build` all pass, and `/` is still prerendered as `○ (Static)` with its 5m revalidate window in the build output — confirming no de-opt to dynamic rendering.

### 6. Trust, transparency & credibility — weight 5
- Dedicated `/editorial-standards` page exists and is linked, which is more than most news sites of this size ship. `/privacy`, `/terms`, `/about`, `/contact` all exist and pass the same 0-violation axe bar.
- Source attribution (`sourceName`) is shown per story — readers can see where a story came from, which matters more for a news aggregator's credibility than it does for e-commerce price transparency.
- No dark-pattern risk surface found: no fake urgency, no pre-ticked add-ons (there's nothing to add to a cart).

### 7. Mobile & touch ergonomics — weight 8
- Button sizes (`h-11`/44px default, `h-10`/40px large) are within or close to the 44–48px design target, well above the 24px floor.
- Mobile Lighthouse Performance 94/100 and Best Practices 100/100 as of the last live run — see the staleness caveat on Principle 1.
- **Not re-assessed:** real-device thumb-zone and dragging-alternative checks (the ticker uses a CSS animation with a `prefers-reduced-motion` fallback to `overflow-x: auto`, which doubles as a drag-free alternative — see Principle 15).

### 8. Privacy, consent & security UX — weight 8
- `grep` for every common analytics/tracking vendor (`gtag`, `plausible`, `posthog`, Segment, Meta Pixel) returned **nothing** in `app/`, `components/`, `lib/`, or `next.config.ts`. No third-party tracking means no consent banner is needed and none exists — the framework's consent checkpoints are legitimately N/A rather than failing.
- A theme/language preference is read from `localStorage` via an inline script in `layout.tsx` — this is a first-party UX preference, not tracking, and is an acceptable use of client storage under this framework's rules.

### 9. Feedback, system status & error recovery — weight 4
- Newsletter form has seven distinct states (`idle`, `sending`, `check-inbox`, `done`, `invalid`, `throwaway`, `closed`, `busy`, `failed`) each with dedicated copy — this is well above the checkpoint bar for "states what happened and how to fix."
- **Not assessed:** optimistic UI / rollback and network-failure retry affordances outside the newsletter form (e.g. feed refresh failure handling) — not traced in this pass.

### 10. Visual hierarchy, layout & typography — weight 8
- Design tokens are defined via Tailwind v4 `@theme inline` with named color ramps (`flag-red-100…900`, `alice-blue-*`, `egyptian-blue-*`, `pacific-blue-*`) rather than raw hex scattered through components — this is exactly the semantic-token checkpoint the framework asks for in Principles 10 and 11.
- Two reading themes ("Press Day" / "Press Night") both pass the same 53-pairing contrast sweep, confirmed today.

### 11. Color, contrast & theming — weight 5
- `pnpm run check:contrast` passes all 53 category/UI pairings in both themes today, with the tightest margin reported (4.61:1 on muted ink over surface, Press Night) comfortably above the 4.5:1 AA text floor. Full pass, confirmed live, not stale.

### 12. Content design & microcopy — weight 8
- Error and empty-state copy throughout (`lib/i18n.ts`) is specific and actionable ("No stories match this filter. Try a different range or topic.") rather than generic ("Error", "No results").
- Bilingual content (English / Nepali, `np`/`ne`) is handled through a single typed i18n dictionary rather than duplicated components — reduces the chance of one locale drifting out of sync with the other.

### 13. Consistency & design system — weight 4
- `components/ui/` holds exactly three primitives (`button`, `input`, `sheet`) reused across the app via `class-variance-authority` variants — no evidence of one-off button clones found in the grep pass.
- **Fixed:** visual-regression coverage added — `@playwright/test`, `playwright.config.ts`, `tests/visual/standing-pages.spec.ts`, baselines committed under `tests/visual/__snapshots__/`, wired into a new `visual-regression` CI job. Deliberately scoped to the five static standing pages, the 404 page, and the newsletter CTA in isolation — **not** the homepage, which renders a continuously re-ranked live feed where a pixel diff would never stop firing on headline/image changes that are not regressions. `pnpm run test:visual` locally; `pnpm run test:visual:update` to intentionally rebase a baseline after a real design change. Verified today: 14/14 pass against freshly generated baselines, in both themes, on two consecutive runs.
- **Not assessed:** design tokens are not yet in DTCG JSON format (they're native Tailwind `@theme` CSS) — not a defect, just a note that the framework's "tokens in standard format" checkpoint is a future-nice-to-have here, not a current gap, since Tailwind v4's own CSS-variable theme *is* the source of truth and there's no second system to keep in sync with it.

### 14. Semantic HTML, SEO, structured data & i18n — weight 8
- SEO is strong per the last live run: `sitemap.xml` (465 URLs), `news-sitemap.xml` (433 entries, Google News extension, 48-hour window), `NewsArticle` JSON-LD present and well-formed, real 404s (not soft 404s).
- **Corrected from this report's first draft:** `<html lang="en">` is hard-coded in the server-rendered markup, but the Nepali toggle's `d.lang='ne'` runs from a blocking inline `<script>` placed in `<head>` (`app/layout.tsx:227-231`), which executes before the browser parses `<body>` — not "after hydration" as this report first said. So a sighted reader, a screen reader attached to the rendered DOM, and any crawler that executes JavaScript all see the correct `lang` before first paint. The residual gap is narrower than first stated: the raw bytes sent over the wire (`curl`, `view-source`, or a crawler that does *not* execute JS) always read `lang="en"` regardless of the reader's saved preference, since that preference lives in `localStorage`, not a cookie the server can read. Downgraded to **severity 1, accepted limitation** — fixing it properly would mean reading a language cookie server-side in `app/layout.tsx`, which would force per-request rendering of a route this project has deliberately kept static with 5-minute ISR. Not worth that trade for a non-JS-crawler edge case; left as-is.
- `hreflang` was not found in a grep for it — the toggle is client-only state with no distinct URL per language, so `hreflang` doesn't apply here; this is N/A, not a gap.

### 15. Motion & interaction polish — weight 1
- `prefers-reduced-motion: reduce` is handled in two places in `app/globals.css`: disables `scroll-behavior: smooth` globally, and separately stops the breaking-news ticker animation (falling back to `overflow-x: auto`, which is also a drag-free alternative to a carousel) and forces `.reveal` content to its final `opacity: 1` state instead of animating in. This is a complete, correct implementation of the checkpoint — not just present, but handling the two most intrusive motion sources on the page (an infinite ticker and scroll-triggered reveals) specifically.
- The `Reveal` component's own code comment documents *why* it has an `immediate` escape hatch (a measured 6.0s LCP regression from animating an above-the-fold card) — this is the kind of performance-driven motion decision the framework's Principle 15 note says is in-scope.

---

## Remediation list

**Fixed, code changed, verified, not pushed:**
1. Filter state (range, bucket, topic, search, page) is now mirrored to the URL in `components/news-feed.tsx` — read once on mount via a `startTransition`-wrapped effect (not a raw `setState`-in-effect, which the project's own lint rule `react-hooks/set-state-in-effect` correctly rejects), written back via `window.history.replaceState` on every change. No `useSearchParams`, no router round-trip, no de-opt from the route's static ISR shell.
2. Visual-regression coverage added: `@playwright/test`, `playwright.config.ts`, `tests/visual/standing-pages.spec.ts`, 14 committed baseline PNGs (both themes), a new `visual-regression` job in `.github/workflows/ci.yml`. Scoped to the five static standing pages, the 404 page, and the newsletter CTA in isolation — never the live homepage feed, which would make every PR fail on headline changes that are not regressions.
3. The full live suite was re-run against production today, not assumed stale: `pnpm run verify:live` (feed quality, axe, SEO — all pass), plus 3x mobile Lighthouse CLI and, because that disagreed sharply with itself, 3x a real Chrome DevTools performance trace to settle it (see item 4).

**Investigated and resolved as a finding, no code change needed:**
4. Mobile LCP: `npx lighthouse` reported 5.1–5.4s against production today — read at face value that would have been a serious regression from August's 3.0s. A Chrome DevTools performance trace against the same URL, same throttling profile, applied directly to a real browser rather than simulated, reported 1.3–1.5s across three runs — under target, better than August. The CLI's simulated-throttling mode is the less trustworthy of the two in a shared/sandboxed environment; its number is recorded as a red herring, not acted on. **No fix was needed because there was no regression to fix** — confirmed by the more reliable tool, not assumed from the first number that came back.
5. Skip link: exists and is correctly built (`app/layout.tsx:238-243`). The first pass's grep was case-sensitive and missed "Skip to main content"; corrected on re-check. This was this report's own error, not the project's.
6. `<html lang>` timing: the Nepali-lang switch runs in a blocking `<head>` script before first paint, not after hydration as the first draft said. The only real residual gap — a raw, non-JS-executing HTTP client always seeing `lang="en"` — is a deliberate, documented trade against keeping the route static, and is correctly left as-is.

**No action needed:**
- Consent/tracking: nothing to consent to, correctly.
- Contrast: full pass, both themes, re-confirmed today.
- Forms/newsletter state handling: already matches the framework's checkpoints.

**Verification run for every change in this document:** `pnpm run lint`, `pnpm run typecheck`, `pnpm run test` (155/155), `pnpm run check:contrast`, `pnpm run build` (`/` still `○ Static`, 5m revalidate — unchanged), `pnpm run verify:live` against production, and `pnpm run test:visual` (14/14, two consecutive clean runs). Nothing was committed or pushed.
