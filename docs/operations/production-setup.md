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

## 6. Post-deploy verification

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
