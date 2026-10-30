# Production setup — the manual work

Everything in this file has to be done by a human in a dashboard. None of it can
be committed, and none of it is done by CI. The code is already written for all
of it; what is missing is configuration that only the account owner can supply.

Work through the sections in order. Section 1 has to be finished and verified
before section 2 will do anything useful.

---

## 1. Register `support@ekjhalak.news`

Two separate things share that address, and they are configured in different
places:

| What | Needs | Where |
|---|---|---|
| **Sending** — the site emails readers from it | A verified domain in Resend | resend.com |
| **Receiving** — a reader replies to it | An inbox or forwarder | Your DNS / mail host |

Resend verifies that you may *send* as `@ekjhalak.news`. It does not give you a
mailbox. If you only do step 1.1, confirmation emails go out correctly and every
reply bounces.

### 1.1 Verify the domain in Resend (sending)

1. Sign in at <https://resend.com> → **Domains** → **Add Domain**.
2. Enter `ekjhalak.news`. Choose the region closest to your readers.
3. Resend shows a set of DNS records to publish. There are normally four:
   - an **MX** record on a `send.` subdomain (Resend's bounce handling),
   - a **TXT** SPF record on that same subdomain,
   - a **TXT** DKIM record on a `resend._domainkey` subdomain,
   - an optional **TXT** DMARC record on `_dmarc`.

   **Copy the exact values from your own dashboard.** They are unique per
   account — anything written down here would be wrong for you.
4. Publish those records wherever `ekjhalak.news` DNS is hosted. If the domain
   is on Netlify DNS: **Domains → ekjhalak.news → DNS records → Add record**.
5. Back in Resend, press **Verify**. Propagation is usually minutes and can take
   up to 48 hours.
6. Create an API key: **API Keys → Create** with **Sending access**. Copy it
   once — it is not shown again. It goes into `RESEND_API_KEY` in section 2.

### 1.2 Create the mailbox (receiving)

Pick one. The first is free and takes two minutes:

- **Forwarding only** — most DNS hosts, Netlify included, do not forward mail.
  Use a dedicated forwarder such as [ImprovMX](https://improvmx.com) (free tier)
  or Cloudflare Email Routing (free, requires the domain on Cloudflare DNS).
  Add their MX records, point `support@ekjhalak.news` at a Gmail address, done.
- **A real mailbox** — Google Workspace or Fastmail, roughly $6–7/user/month.
  Worth it if you want to *send* replies as `support@` rather than from Gmail.

> **MX records conflict.** Resend's MX goes on the `send.` subdomain; your
> inbox provider's MX goes on the apex. Those do not collide — but two inbox
> providers both claiming the apex will. Only publish one set of apex MX records.

### 1.3 Verify it works

```bash
# DNS is published and resolving
dig +short TXT resend._domainkey.ekjhalak.news
dig +short MX  ekjhalak.news

# Resend accepts you as a sender (use your real key)
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"EkJhalak <support@ekjhalak.news>",
       "to":"your-own-address@example.com",
       "subject":"Resend verification",
       "text":"If this arrives, sending is configured."}'
```

Then reply to that email. If the reply lands, receiving is configured too.

---

## 2. Netlify environment variables

**Site configuration → Environment variables.** Set each for the scopes noted.
The code reads these names exactly; a typo fails silently in most cases.

### Required — the site will not work without these

| Variable | Scope | Value |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | All | `https://ekjhalak.news` — the apex, no `www`, no trailing slash |
| `SUPABASE_URL` | All | Your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | All | **Secret.** Server-only; never prefix with `NEXT_PUBLIC_` |
| `REVALIDATE_SECRET` | All | A long random string — `openssl rand -hex 32` |
| `CRON_SECRET` | All | A *different* long random string |

### Required for the newsletter

| Variable | Scope | Value |
|---|---|---|
| `RESEND_API_KEY` | All | From section 1.1. **Spelled RESEND, not RESENT** |
| `NEWSLETTER_SECRET` | All | A third random string — signs the double-opt-in tokens |
| `RESEND_AUDIENCE_ID` | All | Optional; from Resend → Audiences |

> `lib/newsletter.ts` falls back to `RESENT_API_KEY` if `RESEND_API_KEY` is
> absent, because the production key was once stored under that misspelling. It
> logs a warning when it does. Set the correctly-spelled one and delete the
> other.

### Optional — summarization

| Variable | Scope | Value |
|---|---|---|
| `GROQ_API_KEY` | All | Enables AI summaries. **Without it the pipeline still runs** and falls back to extraction |
| `GROQ_DAILY_TOKEN_BUDGET` | All | Tokens/day the model stage may spend. Default 200000 — the free tier |
| `GROQ_MAX_BATCHES_PER_PASS` | All | Batches one pass may take. Default 3 (≈30 stories, ≈24k tokens) |
| `AGGREGATE_BUDGET_MS` | All | **Set this to 45000.** The code default of 15000 starves the archive write |

#### Why the model stage is capped

Groq meters tokens per model per day — 200,000 on the free tier. A measured
batch costs 7,500–9,500 tokens and a pass has about 47 of them, so one full
regeneration wants roughly **376,000 tokens**: nearly twice the entire daily
allowance, against a feed that regenerates every few minutes.

Before the cap, a pass fired all 47 and collected `429`s for most of them,
silently — a 429 only shelves the model, so the visible symptom was a site with
no translations and nothing in the logs saying why. It now logs the exhaustion
with the real figure, and spends what it has on the stories worth spending it
on: stories are ranked before they are batched, so each pass takes its best
thirty, and the archive keeps what it bought. Later passes hydrate those for
free and spend their budget on stories that are new.

Raise `GROQ_DAILY_TOKEN_BUDGET` to match a paid tier. Setting it to `0` disables
the ledger and restores the old spend-until-refused behaviour.

### Optional — OpenRouter (second provider)

| Variable | Scope | Value |
|---|---|---|
| `OPENROUTER_API_KEY` | All | Enables the OpenRouter link in the model chain. Absent = chain behaves exactly as before |
| `OPENROUTER_MODEL_SUMMARY` | All | Default `nvidia/nemotron-3-super-120b-a12b:free` |
| `OPENROUTER_MODEL_TRANSLATE` | All | Default `google/gemma-4-31b-it:free` |
| `OPENROUTER_DAILY_REQUEST_BUDGET` | All | Requests/day. Default 50; **set to 1000 after buying $10 of credits once** |
| `OPENROUTER_MINUTE_REQUEST_LIMIT` | All | Default 20. Only matters once the daily budget is raised |
| `OPENROUTER_SITE_URL` | All | Optional. Sent as `HTTP-Referer` for leaderboard attribution |
| `OPENROUTER_APP_TITLE` | All | Optional. Sent as `X-Title` |

Chain order is Groq → OpenRouter → Gemini. Groq leads because it is the only
link measured against these prompts in production; OpenRouter sits ahead of
Gemini on allowance alone (50 free requests a day against Gemini's 20).

#### OpenRouter inverts the batching rule

This is the part that is easy to get backwards, because it is the opposite of
everything the Groq cap above says.

| | Groq | OpenRouter free |
|---|---|---|
| Metered in | **tokens** | **requests** |
| Daily | 200,000 per model | 50 per *account* (1,000 after one $10 purchase) |
| Tighter cap | **8,000 tokens/minute** | 20 requests/minute |
| Scoped | per organization **per model** | per account, across all `:free` models |
| Bigger batches | cost more | cost **the same** |

Three consequences:

1. **`GROQ_BATCH_SIZE=3` exists for Groq's minute cap, and is actively wrong
   for OpenRouter.** At 3, this feed's ~161 stories/day need ~108 requests
   (summary + translation) and will not fit in 50. At 20 the same work is ~18
   requests. The free models carry 256k–1M context, so a batch of 20 is one
   request exactly like a batch of 3. Raise it **only** if you promote
   OpenRouter ahead of Groq — otherwise it breaks Groq's minute window, which
   is what the 3 is sized for.
2. **Splitting the two jobs across two models buys nothing here.** On Groq that
   is precisely what buys capacity (summary on `gpt-oss-120b`, translation on
   `qwen3.8-27b`, separate 200k pots). OpenRouter's cap is per account, so
   `lib/request-ledger.ts` keeps **one** counter, deliberately not keyed by
   purpose. A per-purpose counter would believe it had twice the allowance.
3. **Failed requests may count.** `recordRequestSpend` is therefore called
   before the reply, not after, and a 429 is skipped rather than provoked.

The `$10` threshold is lifetime *purchases*, not balance — spend every cent and
the 1,000/day entitlement stays. It is the cheapest constraint removal
available to this project.

> **Not yet measured.** The two default model IDs are informed guesses, not
> results. Gemma 4 is the better bet for Nepali on Google's Devanagari
> coverage; neither has been scored against this pipeline's prompts. Run
> `scripts/translate-bakeoff.mjs` with the *production* prompt before promoting
> OpenRouter ahead of Groq — a weak harness prompt once scored `qwen3.8-27b` at
> 48% and nearly got a perfectly good model dropped.

> Free model IDs churn; OpenRouter's catalogue dropped one mid-October 2026. A
> vanished ID answers 404, which shelves that entry for the process and falls
> through to the next link — the pass degrades, it does not fail.

#### Why `AGGREGATE_BUDGET_MS` must be raised

The per-stage budgets are *slices* of `AGGREGATE_BUDGET_MS`, not additions to
it, so a per-stage value larger than the aggregate can never be honoured. The
archive write is the last thing a pass does and its budget is clamped to
whatever is left (`lib/article-store.ts`), so at 15000 it is starved and aborts:
measured as `write failed after 0 of 455 rows`. At 45000 the same pass writes
every row with no failures.

`NEWSLETTER_FROM` and `NEWSLETTER_REPLY_TO` both default to
`support@ekjhalak.news` in code. Only set them to override.

---

## 3. Netlify build settings

Most of this is in `netlify.toml` and needs no dashboard work — values there win
over the UI. Confirm only:

- **Build command** and **publish directory**: leave blank in the UI, or matching
  `netlify.toml` (`pnpm run build` / `.next`).
- **Node version**: pinned to 22 by `netlify.toml`. Remove any conflicting
  `NODE_VERSION` set in the UI.
- **The Next.js plugin** is declared in `netlify.toml`. If the UI also lists it
  under Plugins, that is fine — it is the same plugin.

> The build runs `next build --webpack` deliberately. Netlify's Next Runtime
> cannot resolve Turbopack's font module and fails with 28 copies of
> `Module not found: '@vercel/turbopack-next/internal/font/google/font'`.
> `netlify.toml` explains this at the build command. Do not "fix" it by removing
> the flag.

---

## 4. Domain and DNS

- **Domains → Add domain → `ekjhalak.news`.** Add `www.ekjhalak.news` too and
  set it to redirect to the apex.
- The apex is canonical. `lib/site-url.ts` defaults to it and CI builds against
  it; publishing `www` canonicals would put a 301 in front of every URL the site
  calls canonical.
- **HTTPS → Verify DNS configuration → Provision certificate.** Let's Encrypt,
  free, renews itself.
- HSTS is already sent by `netlify.toml` with a two-year max-age and `preload`.
  Only submit to the [preload list](https://hstspreload.org) once you are
  certain every subdomain will be HTTPS forever — it is hard to undo.

---

## 5. Scheduled refresh

The pipeline needs something to call it. Netlify Scheduled Functions or an
external cron both work; the endpoint checks `CRON_SECRET` either way.

```bash
curl -X POST "https://ekjhalak.news/api/revalidate" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Every 15–30 minutes is reasonable for a news feed. More often mostly spends
Groq quota re-summarizing stories that have not changed.

---

## 6. The daily digest

Every morning the site emails each confirmed subscriber the last 24 hours of
stories: the top 25 by how many outlets ran them, split into Nepal and World,
in the reader's own language, with a personal unsubscribe link (and the
one-click `List-Unsubscribe` header mail clients show as a button).

### 6.1 Database

Apply both migrations, in order, to the production database. They are
re-runnable and add the two subscriber tables and the delivery ledger:

```bash
psql "$DATABASE_URL" -f db/migrations/0001_newsletter_tables.sql
psql "$DATABASE_URL" -f db/migrations/0002_digest_deliveries.sql
```

On Supabase, paste each file into the SQL editor instead
(<https://supabase.com/dashboard/project/_/sql/new>). Both turn on row level
security so the address list is not readable through Supabase's REST API; the
app connects as `postgres` and is unaffected.

### 6.2 Variables

Nothing new is required — the digest needs `DATABASE_URL`, `RESEND_API_KEY`,
`NEWSLETTER_SECRET` and `CRON_SECRET`, all set above. Set them wherever the site
is actually hosted: production answers with `server: Vercel`, so that is Vercel →
Project → Settings → Environment Variables (the Netlify wording elsewhere in this
file is out of date). Two optional ones:

| Variable | Default | Meaning |
|---|---|---|
| `DIGEST_MAX_STORIES` | 25 | Stories per email |
| `DIGEST_BUDGET_MS` | 25000 | Time one run may spend sending before it stops and leaves the rest to the next trigger |

### 6.3 Schedule (Cloudflare Cron Triggers)

`cloudflare/worker.mjs` runs the digest when a trigger fires with one of the
expressions in its `DIGEST_CRONS`. Add **all three** under Workers → `ekjhalak`
→ Settings → Triggers → Cron Triggers (the strings must match exactly):

| Expression (UTC) | Nepal time |
|---|---|
| `15 1 * * *` | 07:00 |
| `30 1 * * *` | 07:15 |
| `45 1 * * *` | 07:30 |

Three, not one, on purpose: each run claims only readers who have not had
today's digest, so the second and third find nothing to do — unless the first
was cut short by `DIGEST_BUDGET_MS` or a provider throttle, in which case they
finish it. Nobody is mailed twice. The Worker needs the `CRON_SECRET` secret
(and `ORIGIN_URL` if the site is not at the default origin). Any other
scheduler works too: `GET /api/cron/digest` with `Authorization: Bearer
$CRON_SECRET`.

### 6.4 Check it before the first morning

```bash
# What a run would do — stories picked and readers addressed. Sends nothing.
curl -s "https://ekjhalak.news/api/cron/digest?dry=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expect `"status":"dry-run"` with a story count and the number of confirmed
subscribers. `503` means a prerequisite is missing and the body's `reason` says
which (`no-database`, `no-mail-transport`, `no-signing-key`). The first real
send is the 07:00 trigger; its result is in the Worker's logs as
`[worker] GET /api/cron/digest -> 200 {...}`.

### 6.5 Limits worth knowing

- **Resend's plan caps daily sending.** A list larger than the cap cannot be
  mailed in one morning; check the plan before the list grows.
- **A bounced address is retried** at each of the day's three triggers (and
  tomorrow) until its status is changed to `bounced` in `subscribers`. There is
  no bounce webhook yet.
- **The unsubscribe endpoint's rate limit is per instance**, like the subscribe
  endpoint's (see *Known gap*). The token is what protects it.

---

## 7. Post-deploy verification

Run these against production once the above is done:

```bash
curl -sI https://ekjhalak.news | grep -i "strict-transport\|x-frame\|x-content"
curl -s  https://ekjhalak.news/sitemap.xml | head -5
curl -s  https://ekjhalak.news/robots.txt

pnpm run check:seo https://ekjhalak.news
node scripts/axe-scan.mjs https://ekjhalak.news/ --theme=light
node scripts/axe-scan.mjs https://ekjhalak.news/ --theme=dark
```

Then subscribe with a real address and confirm the opt-in email arrives, the
confirmation link works, and a reply to it reaches your inbox. That exercises
sections 1.1, 1.2 and 2 end to end, which nothing else does.

---

## Known gap

**Rate limiting does not survive serverless.** `lib/rate-limit.ts` is an
in-process fixed-window limiter, and its own comment is honest that it is
per-instance. On a long-lived server that is adequate. On Netlify Functions each
request may land on a fresh instance with an empty map, so the subscribe
endpoint is closer to unlimited than to rate-limited.

It is not currently exploitable for much: signup is double-opt-in, so the worst
outcome is confirmation emails sent to addresses that never confirm — which
costs Resend quota and can hurt sending reputation. Worth fixing before any
paid launch, by moving the limiter to a shared store (Upstash Redis is the usual
choice) or putting Netlify's own rate limiting in front of `/api/subscribe`.
`lib/rate-limit.ts` is the single place that would change.
