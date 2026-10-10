# Five features worth charging for

`docs/product/monetization.md` sets the pricing, the tiers and the sequencing, and the one
constraint that governs everything: **no programmatic display ads.** This file
is narrower. It names the five features most likely to make someone pay, and it
grades each by what the codebase already has rather than by how good the idea
sounds.

They are in build order. The first is the one to build.

---

## 1. Coverage comparison — "who else ran this, and how"

**The pitch:** one story, every outlet that carried it, side by side. Which
newsroom led with the arrest and which led with the denial. Which ones did not
run it at all.

**Why this one first:** it is the only feature here that competitors
structurally cannot copy, and the data already exists. `alternateSourceIds[]` is
captured inside the dedup pass — at the one moment the answer is knowable — and
nothing currently reads it. Every other Nepali aggregator shows a flat list of
headlines because a flat list is all their pipeline produces.

It is also the feature that justifies the product's framing. A reader who wants
headlines has twenty free options; a reader who wants to know whether a story is
being reported differently has none.

**Built:** `alternateSourceIds[]`, the 35-source ingest, dedup, per-source
weighting.
**Needed:** a comparison view, and a framing diff (one more Groq pass over
headlines that already exist — cheap, since the summaries are written anyway).

**Sell it as:** the free tier shows the count ("6 outlets covering"). Pro opens
the comparison.

---

## 2. Story tracking — "what changed since you last read this"

**The pitch:** follow a story. Get told what is new, not the whole thing again.

**Why it works:** this is the feature that turns a daily visit into a habit, and
habit is what retention is. It also sells itself to exactly the people who pay —
a policy analyst following a bill does not want to re-read yesterday's coverage
to find today's development.

**Built:** permalinks, structured data, dedup, timestamps.
**Needed:** the archive (switched off — `docs/planning/execution-plan.md` Phase 7), auth, and a diff
between a story's state at two times. The archive is the blocker for this and
for features 3 and 5, which is a strong argument for provisioning it first.

**Sell it as:** free readers follow three stories. Pro is unlimited.

---

## 3. Alerts — keyword and entity watch

**The pitch:** tell us what you care about; we tell you the moment it moves.

**Why it works:** this is the single most reliable thing to charge a business
user for, across every news product that has tried it. It converts because the
alternative is a person checking manually, and a person's time costs more than
$7/month. `docs/product/monetization.md` already names `Pro Alerts` as a candidate wedge.

**Built:** the ingest, the taxonomy, Resend, double opt-in, the email templates.
**Needed:** auth, watch-term storage, a delivery scheduler. Less work than it
sounds — the sending path is finished and tested.

**Sell it as:** Pro only. This is the clearest paid/free line in the product.

---

## 4. On-demand translation, either direction

**The pitch:** every story readable in English or Nepali, whichever you want,
not whichever the source published.

**Why it works:** it serves the diaspora — a large, geographically dispersed
audience with the highest willingness to pay and no good alternative — and it
serves international desks covering Nepal. Right now the site is bilingual in
its *chrome* but each story stays in its source language. A reader who only
reads English silently loses most of the Nepali-language coverage, which is most
of the coverage.

**Built:** the full i18n layer, `lib/i18n.ts`, Mukta/Devanagari typography, the
Groq pipeline, language detection per source.
**Needed:** a translation pass and a cache. Genuinely small — this is the best
effort-to-value ratio on the list.

**Sell it as:** free gets the UI in both languages (as today). Pro gets the
*stories* in both.

---

## 5. Institutional briefings — white-label, scheduled

**The pitch:** your organization's topics, your branding, in your inbox every
Monday at 7am.

**Why it works:** the highest-margin item in the revenue mix, and the one with
the longest contracts. NGOs, embassies, policy desks and PR teams in Kathmandu
already pay people to do this by hand. `docs/product/monetization.md` prices this at
$29–$99/month for teams; institutional contracts go well above that.

**Built:** topic taxonomy, source weighting, the email rail.
**Needed:** everything in features 1–3, plus PDF rendering and per-account
branding. This is a Phase 4 item. Listed here because it is where the revenue
actually is, and because features 1–3 are worth building partly as its
foundation.

**Sell it as:** annual contracts, invoiced.

---

## The dependency that matters

Three of these five are blocked on the archive, which is currently switched off.

```
archive ──┬── 2. story tracking
          ├── 3. alerts
          └── 5. institutional briefings

(1. coverage comparison and 4. translation need neither archive nor auth)
```

So the order is: **ship 1 and 4 now** — they are unblocked, they are small, and
they are the two that make the product visibly different from a feed reader.
Use them to validate that anyone will pay at all. Then provision the archive and
build 2, 3 and 5 against a question you already know the answer to.

---

## What not to build

Worth writing down, because each of these will be suggested:

- **A mobile app.** The site is responsive and passes axe on every route in both
  themes. An app is a second codebase to maintain for the same content.
- **Comments.** A moderation obligation in two languages, on political news, for
  a one-person team.
- **More sources.** 35 already produce more than anyone reads. The problem this
  product solves is too much news, not too little — adding sources makes the
  product worse at its own stated job.
