# Monetizing EkJhalak

How this pays for itself, and what has actually been built toward that.

The one rule that constrains everything below: **no programmatic display ads.**
They contradict the product's own stated identity — "no clutter, no noise" — and
they are the only thing genuinely separating EkJhalak from every other Nepali
aggregator, all of which are ad-supported. What gets monetized is the reading
experience and the digest, not the page furniture.

---

## Changelog

### 2026-08-06 — infrastructure, not revenue

Shipped, and directly relevant to everything below:

- **Story permalinks** (`/story/[id]`) with `NewsArticle` structured data, per-story
  OG/Twitter tags, and a Google News sitemap. Nothing was individually indexable
  or shareable before this; the sitemap listed six URLs and now lists 465. This is
  the surface any paywall, analytics or digest link has to attach to.
- **A mandatory 400-character display cap** on every reader-facing surface. Not a
  design choice — see the SaaS Layer section of `README.md`. It is what makes
  permalinked, indexed, monetized pages defensible while linking out to
  publishers who litigate this exact pattern.
- **`alternateSourceIds[]`** — which outlets carried a story, not merely how many.
  Captured inside the dedup pass at the only moment the answer exists. This is the
  raw material for the coverage-comparison view identified below as the wedge, and
  it did not exist before; the README had described it for some time without it
  ever having been built.
- **The newsletter was silently dead** and now is not. The Resend key was stored
  under a misspelled variable name, so every signup since launch was answered with
  "the list is not open yet" and nothing was ever sent. Any digest revenue depends
  on this working.
- **Performance and accessibility**, because a paid product cannot ship a 19.6 s
  mobile LCP: 67 → 94 mobile, 77 → 100 desktop, zero axe violations at any
  severity.

**Not shipped:** auth, Stripe, the paywall boundary, digest delivery, and the NPR
payment rail. All of them depend on the archive being provisioned, which is
currently switched off. See `dev.md`, Phases 7 and 8.

---

## The plan

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

### Recommended Revenue Mix

1. Subscriptions (primary)
Individual and team recurring plans should drive most revenue.

2. B2B intelligence reports (high margin)
Recurring institutional briefings with SLA-backed delivery.

3. Ethical sponsorships (secondary)
Limited, clearly labeled sponsorship placements in digest emails only.

4. Affiliate referrals (selective)
Only for relevant tools and services with strict quality standards.

---

### KPIs to Track Weekly

1. Visitor → signup conversion
2. Signup → activated user conversion
3. Activated user → paid conversion
4. Monthly churn rate
5. ARPU (average revenue per user)
6. LTV/CAC ratio
7. Digest open and click-through rates
8. Retention at day 7, 30, and 90

---

### 30-Day Execution Checklist

1. Add waitlist + pricing page
2. Implement auth + Stripe billing
3. Launch one premium feature (`Pro Digest` recommended)
4. Add product analytics events (activation funnel)
5. Run first 10 paid user pilots
6. Publish one institutional plan page
7. Ship weekly product update notes
8. Review KPI dashboard every Monday
