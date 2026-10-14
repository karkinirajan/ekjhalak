# Moving to a VPS with local PostgreSQL

Replacing Supabase with Postgres on your own box, adding a real subscriber
table, and running the site from a VPS instead of Netlify.

Every command here is meant to be pasted. Where a value is yours rather than
mine it appears as `<ANGLE_BRACKETS>` — substitute before running. Nothing in
this file should be run blind on a box that already serves traffic.

---

## What this actually involves

Read this part before touching the VPS. Three of the five steps are code, not
configuration, and one of them is work that does not exist yet.

| Piece | State today | What the move needs |
|---|---|---|
| Article archive | Supabase PostgREST over HTTPS, **6,387 rows** | Rewrite `lib/article-store.ts` onto a Postgres driver |
| Subscriptions | **No table, no rows, nowhere** | Build it — table, writes, confirm handler |
| Resend | Working, domain verified | Unchanged. Only `support@` inbox is missing |
| Hosting | Netlify | Node process behind Nginx, systemd, certbot |
| Scheduled refresh | Netlify scheduled function | systemd timer or cron |

**Subscriptions are stateless right now.** `/api/subscribe` sends an HMAC-signed
link and `/api/subscribe/confirm` verifies the signature and redirects. Neither
writes anything down. There is no subscriber list in this project — if someone
confirmed last week, nothing anywhere knows. So "set up a subscriptions table"
is new behaviour, not a migration, and §5 builds it.

**The archive is a real migration.** `lib/article-store.ts` speaks PostgREST
over HTTPS — URLs like `/rest/v1/articles?on_conflict=id`, an `apikey` header,
`Prefer: resolution=merge-duplicates`. None of that exists against a plain
Postgres. Seven exported functions change, and §6 is a rewrite rather than a
config swap.

**Decide about the 6,387 existing rows before you start.** They are enrichment
the pipeline already paid Groq for. Dumping and restoring them (§4.4) keeps
that; starting empty throws it away and the archive refills slowly, which also
means the site serves untranslated stories until it does.

---

## 0. Before you SSH

Have these to hand:

- VPS address and the user you log in as
- A domain or subdomain pointing at the VPS, if it will serve traffic publicly
- Your current `.env` — the Groq, Gemini and Resend keys carry over unchanged
- A Supabase dump, if you are keeping the rows (§4.4)

Check your VPS specs. The pipeline holds 450 stories in memory per pass and
Postgres wants its own room. 2 GB RAM is the floor; 1 GB will swap and the
45-second pass budget will start timing out.

---

## 1. SSH in

```bash
ssh <USER>@<VPS_IP>
```

If you have not set up a key yet, do that from your laptop first — password
login is the single most common way a VPS gets taken:

```bash
# on your laptop
ssh-keygen -t ed25519 -C "ekjhalak-vps"
ssh-copy-id <USER>@<VPS_IP>
```

Then, on the VPS, turn password login off:

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sudo systemctl reload ssh
```

Keep your current session open until you have confirmed a second one still
connects. Locking yourself out here means a console session with your provider.

### Basics

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw build-essential

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

Postgres gets **no** firewall rule. It listens on localhost and the app talks to
it over a Unix socket; opening 5432 to the internet is how Postgres boxes get
found.

---

## 2. Node and pnpm

Match CI and `netlify.toml`, which pin Node 22. A different major here means
the box runs something no gate has tested.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable

node -v        # expect v22.x
pnpm -v        # corepack reads packageManager from package.json
```

---

## 3. GitHub and the clone

A **deploy key**, not your personal key: it is scoped to this one repository,
read-only, and revoking it costs nothing.

```bash
ssh-keygen -t ed25519 -C "ekjhalak-deploy@<VPS_HOSTNAME>" -f ~/.ssh/ekjhalak_deploy -N ""
cat ~/.ssh/ekjhalak_deploy.pub
```

Copy that line. On GitHub: **repo → Settings → Deploy keys → Add deploy key**,
paste it, leave *Allow write access* **unchecked**.

```bash
cat >> ~/.ssh/config <<'EOF'

Host github-ekjhalak
  HostName github.com
  User git
  IdentityFile ~/.ssh/ekjhalak_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

ssh -T github-ekjhalak     # "successfully authenticated" is the pass
```

```bash
sudo mkdir -p /srv && sudo chown "$USER":"$USER" /srv
git clone github-ekjhalak:<GITHUB_USER>/ekjhalak.git /srv/ekjhalak
cd /srv/ekjhalak
pnpm install --frozen-lockfile
```

---

## 4. PostgreSQL

### 4.1 Install

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
psql --version
```

### 4.2 Role and database

Generate the password rather than inventing one, and keep it out of your shell
history — `read -s` does both:

```bash
read -rsp "New DB password: " DBPASS; echo
sudo -u postgres psql <<SQL
CREATE ROLE ekjhalak WITH LOGIN PASSWORD '${DBPASS}';
CREATE DATABASE ekjhalak OWNER ekjhalak;
SQL
```

The app owns its own database and nothing else. No superuser, no access to
other databases on the box.

### 4.3 Schema

Three tables. `articles` is the archive the pipeline already writes;
`subscribers` and `subscription_events` are new.

```bash
cat > /tmp/schema.sql <<'SQL'
-- ── articles ──────────────────────────────────────────────────────────────
-- Same shape as supabase/migrations/20260806000000_articles.sql. The id is the
-- SHA-256 of the normalized URL, first 12 hex, computed in feed-normalizer.ts —
-- the identity every stage already means by "this story".
CREATE TABLE IF NOT EXISTS articles (
  id                   text PRIMARY KEY,
  source_url           text NOT NULL,
  source_id            text NOT NULL,
  source_name          text NOT NULL,
  title                text NOT NULL,
  summary              text NOT NULL,
  original_lang        text NOT NULL,
  title_translated     text,
  summary_translated   text,
  bucket               text,
  topic                text,
  category             text,
  credibility          text,
  image_url            text,
  published_at         timestamptz,
  first_seen_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at         timestamptz NOT NULL DEFAULT now(),
  coverage_count       integer NOT NULL DEFAULT 1,
  alternate_source_ids text[] NOT NULL DEFAULT '{}',
  canonical_id         text,
  enrichment_key       text,
  quality              jsonb
);

CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS articles_last_seen_at_idx ON articles (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS articles_coverage_idx     ON articles (coverage_count DESC);
-- Hydration looks stories up by enrichment_key to decide whether it must pay a
-- model. Without this index that lookup is a sequential scan on every pass.
CREATE INDEX IF NOT EXISTS articles_enrichment_key_idx ON articles (enrichment_key)
  WHERE enrichment_key IS NOT NULL;

-- ── subscribers ───────────────────────────────────────────────────────────
-- New. Double opt-in is enforced by `status`: a row is created `pending` when
-- someone asks, and only `confirmed` rows are ever sent anything.
--
-- The address is stored lowercased, and the UNIQUE constraint is what makes
-- re-subscribing idempotent: asking twice updates one row rather than creating
-- a second, so a confirmed reader cannot be silently reverted to pending.
CREATE TABLE IF NOT EXISTS subscribers (
  id              bigserial PRIMARY KEY,
  email           text NOT NULL UNIQUE,
  language        text NOT NULL DEFAULT 'en' CHECK (language IN ('en','np')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','unsubscribed','bounced')),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz,
  -- Kept for abuse investigation, not analytics. See the retention note below.
  source_ip       inet,
  user_agent      text
);

CREATE INDEX IF NOT EXISTS subscribers_status_idx ON subscribers (status)
  WHERE status = 'confirmed';

-- ── subscription_events ───────────────────────────────────────────────────
-- An append-only log. `subscribers` says what is true now; this says what
-- happened, which is the only way to answer "did they actually confirm, and
-- when" after a row has been updated.
CREATE TABLE IF NOT EXISTS subscription_events (
  id            bigserial PRIMARY KEY,
  subscriber_id bigint REFERENCES subscribers(id) ON DELETE CASCADE,
  event         text NOT NULL
                  CHECK (event IN ('requested','confirmed','unsubscribed','bounced','resent')),
  at            timestamptz NOT NULL DEFAULT now(),
  detail        jsonb
);

CREATE INDEX IF NOT EXISTS subscription_events_subscriber_idx
  ON subscription_events (subscriber_id, at DESC);
SQL

psql "postgresql://ekjhalak:${DBPASS}@localhost/ekjhalak" -f /tmp/schema.sql
rm /tmp/schema.sql
```

Verify:

```bash
psql "postgresql://ekjhalak:${DBPASS}@localhost/ekjhalak" -c '\dt'
```

> **Retention.** `source_ip` and `user_agent` are personal data under most
> privacy regimes, and the site's own privacy page should say they are kept. If
> you would rather not hold them, drop both columns — nothing in the app reads
> them. If you keep them, add a monthly job that nulls them on rows older than
> ninety days; they are for investigating abuse, and abuse is not investigated
> a year later.

### 4.4 Bringing the 6,387 rows across

Skip if you are starting empty, and accept the site runs on publisher text
until the archive refills.

```bash
# From your laptop, where .env has the Supabase credentials:
pg_dump "$DATABASE_URL" \
  --table=public.articles --data-only --no-owner --no-privileges \
  > articles.sql

scp articles.sql <USER>@<VPS_IP>:/tmp/
```

```bash
# On the VPS:
psql "postgresql://ekjhalak:${DBPASS}@localhost/ekjhalak" -f /tmp/articles.sql
psql "postgresql://ekjhalak:${DBPASS}@localhost/ekjhalak" \
  -c 'SELECT count(*) AS rows,
             count(summary_translated) AS translated,
             count(enrichment_key) AS enriched
      FROM articles;'
rm /tmp/articles.sql
```

Compare that `rows` figure against Supabase before you decommission anything.

---

## 5. Code: the subscriber table

**This does not exist yet and must be written.** The runbook can stand the
database up; it cannot invent the handler. What is needed:

1. `pnpm add pg` and `pnpm add -D @types/pg`
2. A `lib/db.ts` holding one pooled client, read from `DATABASE_URL`
3. `lib/subscribers.ts` with `recordRequest(email, lang, ip, ua)` and
   `confirmSubscriber(email)`, each writing a `subscription_events` row
4. `app/api/subscribe/route.ts` calls `recordRequest` before sending the email
5. `app/api/subscribe/confirm/route.ts` calls `confirmSubscriber` **after** the
   HMAC verifies and before the redirect
6. An unsubscribe route, which you are legally required to provide the moment
   you send a newsletter to a list

Two things worth getting right the first time:

**Record the request before the send, not after.** If Resend fails you still
want to know someone asked; a `pending` row with no confirmation is diagnosable,
a silent nothing is not.

**Confirming must stay idempotent.** People click the link twice, and mail
clients prefetch it. `UPDATE ... WHERE status = 'pending'` plus an event row
means the second click changes nothing and the log still shows one confirmation.

The HMAC token stays exactly as it is. It is what proves the click came from
the inbox that asked, and the table is a record of that — not a replacement
for it.

---

## 6. Code: replacing the Supabase client

`lib/article-store.ts` speaks PostgREST over HTTPS. Against a local Postgres
every call changes. The seven exported functions:

| Function | Today | Becomes |
|---|---|---|
| `isStoreConfigured()` | checks `SUPABASE_URL` | checks `DATABASE_URL` |
| `countArticles()` | `Prefer: count=exact` | `SELECT count(*)` |
| `recordArticles()` | `POST ?on_conflict=id` | `INSERT … ON CONFLICT (id) DO UPDATE` |
| `fetchEnrichments()` | `?id=in.(…)` | `WHERE id = ANY($1)` |
| `fetchStoredStory()` | `?id=eq.…&limit=1` | `WHERE id = $1 LIMIT 1` |
| `archiveStatus()` | in-memory counters | unchanged |
| `noteHydrate()` | in-memory counters | unchanged |

Three things not to lose in the rewrite, each of which is there because
something went wrong without it:

- **The write is bounded and swallows its own failures.** A Postgres that is
  slow must not fail the feed; the archive is fire-and-forget by design and the
  site is required to work with it empty or unreachable.
- **Writes are batched.** 500 rows per statement, not 500 statements. The
  measured write was 500 rows in 329 ms.
- **`ON CONFLICT` must not null out enrichment.** The current upsert only
  writes the enrichment columns for stories this pass actually enriched. A naive
  `DO UPDATE SET` over every column overwrites a translation with NULL on the
  next pass that sees the story unenriched — losing work already paid for.

The upside of the move: no HTTP, no 5-second socket contention, no PostgREST
schema cache. The intermittent archive-write timeout should disappear.

---

## 7. Environment

```bash
cd /srv/ekjhalak
cp .env.example .env     # if present; otherwise create it
chmod 600 .env           # the file holds every credential
nano .env
```

Changes from the Netlify environment:

```
# Replaces every SUPABASE_* variable, which can all be deleted.
DATABASE_URL=postgresql://ekjhalak:<DBPASS>@localhost:5432/ekjhalak

NEXT_PUBLIC_SITE_URL=https://<YOUR_DOMAIN>
```

Carry over unchanged: `GROQ_API_KEY`, `EKJHALAK_SUMMARY`,
`EKJHALAK_TRANSLATION`, `GROQ_MODEL_SUMMARY`, `GROQ_MODEL_TRANSLATE`,
`GEMINI_API_KEY`, `GEMINI_MODEL_SUMMARY`, `GEMINI_MODEL_TRANSLATE`,
`RESEND_API_KEY`, `NEWSLETTER_SECRET`, `REVALIDATE_SECRET`, `CRON_SECRET`,
`PUBLISH_POLICY`, `AGGREGATE_BUDGET_MS=45000`, `GROQ_BATCH_SIZE=3`.

Delete: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLIC_ANON_KEY`, `RESENT_API_KEY`.

> `DATABASE_URL` used to be read only to recover a Supabase project ref — see
> the comment in `lib/article-store.ts`. After §6 it is the connection itself,
> which is what the name always suggested.

---

## 8. Build and run

```bash
cd /srv/ekjhalak
pnpm run verify      # lint, typecheck, 165 tests, contrast, audit, build
```

Do not continue past a failure here. Everything downstream assumes this passed.

```bash
sudo tee /etc/systemd/system/ekjhalak.service >/dev/null <<EOF
[Unit]
Description=EkJhalak News
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/srv/ekjhalak
EnvironmentFile=/srv/ekjhalak/.env
ExecStart=/usr/bin/pnpm run start
Restart=always
RestartSec=10
# The pipeline holds a pass in memory; this is a ceiling, not a target.
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ekjhalak
sudo systemctl status ekjhalak --no-pager
curl -sI localhost:3000 | head -1
```

---

## 9. Nginx and TLS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/ekjhalak >/dev/null <<'EOF'
server {
    listen 80;
    server_name <YOUR_DOMAIN>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # lib/rate-limit.ts reads the first entry of X-Forwarded-For. Without
        # this every visitor shares one bucket and the limiter does nothing.
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        # A cold pass takes up to 45s; the default 60 is thin on a slow fetch.
        proxy_read_timeout 90s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/ekjhalak /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d <YOUR_DOMAIN> --agree-tos -m <YOUR_EMAIL> --redirect
```

Certbot installs its own renewal timer. Confirm it:

```bash
sudo systemctl list-timers | grep certbot
```

`netlify.toml` sent the security headers. Nginx has to now — HSTS, frame
options, nosniff, referrer and permissions policy. Add them inside the `server`
block after certbot has written its TLS section.

---

## 10. Scheduled refresh

Netlify's scheduled function is gone. A systemd timer replaces it:

```bash
sudo tee /etc/systemd/system/ekjhalak-refresh.service >/dev/null <<'EOF'
[Unit]
Description=EkJhalak feed refresh
After=ekjhalak.service

[Service]
Type=oneshot
EnvironmentFile=/srv/ekjhalak/.env
ExecStart=/bin/bash -c 'curl -fsS -X POST "http://127.0.0.1:3000/api/revalidate?secret=$REVALIDATE_SECRET" >/dev/null'
EOF

sudo tee /etc/systemd/system/ekjhalak-refresh.timer >/dev/null <<'EOF'
[Unit]
Description=Refresh the feed every 30 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=30min
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ekjhalak-refresh.timer
sudo systemctl list-timers | grep ekjhalak
```

Thirty minutes, not five. The Groq free tier affords roughly 25 batches a day;
a five-minute timer spends that before breakfast and serves publisher text for
the rest of the day.

`POST` with `?secret=` is the contract `/api/revalidate` expects — `GET` takes
`CRON_SECRET` in an Authorization header instead. They are not interchangeable.

---

## 11. Backups

A VPS database with no backup is a database you will lose. Supabase was doing
this for you; now you are.

```bash
sudo mkdir -p /var/backups/ekjhalak && sudo chown "$USER":"$USER" /var/backups/ekjhalak

cat > /srv/ekjhalak/scripts/backup-db.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
source /srv/ekjhalak/.env
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump "$DATABASE_URL" --no-owner --no-privileges \
  | gzip > "/var/backups/ekjhalak/ekjhalak-${STAMP}.sql.gz"
# Fourteen days on the box. Anything that matters longer belongs off it.
find /var/backups/ekjhalak -name 'ekjhalak-*.sql.gz' -mtime +14 -delete
EOF
chmod +x /srv/ekjhalak/scripts/backup-db.sh

( crontab -l 2>/dev/null; echo "0 3 * * * /srv/ekjhalak/scripts/backup-db.sh" ) | crontab -
```

Then **restore one into a scratch database**. A backup nobody has restored is a
hypothesis.

```bash
sudo -u postgres createdb restore_test
gunzip -c /var/backups/ekjhalak/<FILE>.sql.gz | psql -U postgres restore_test
psql -U postgres restore_test -c 'SELECT count(*) FROM articles;'
sudo -u postgres dropdb restore_test
```

---

## 12. Deploying a change

```bash
cd /srv/ekjhalak
git pull
pnpm install --frozen-lockfile
pnpm run verify
sudo systemctl restart ekjhalak
```

There is a gap between `restart` and the first served request. For a news site
read in bursts that is acceptable; if it stops being acceptable, the answer is
two ports and an Nginx upstream switch, not a longer timeout.

---

## 13. Verify the whole thing

```bash
curl -sI https://<YOUR_DOMAIN> | grep -iE "strict-transport|x-frame|x-content"
curl -s  https://<YOUR_DOMAIN>/robots.txt
curl -s  https://<YOUR_DOMAIN>/sitemap.xml | head -3
curl -s -o /dev/null -w '%{http_code}\n' "https://<YOUR_DOMAIN>/api/news?range=day"

psql "$DATABASE_URL" -c \
  'SELECT count(*) rows, count(summary_translated) translated FROM articles;'

journalctl -u ekjhalak -n 40 --no-pager | grep -E '\[summary\]|\[translation\]|\[enrich\]'
```

From your laptop, against the live site:

```bash
pnpm run check:seo https://<YOUR_DOMAIN>
node scripts/axe-scan.mjs https://<YOUR_DOMAIN>/ --theme=dark
```

Then subscribe with a real address and confirm the mail arrives, the link
works, and `SELECT * FROM subscribers` shows `confirmed`. That is the one path
nothing else exercises.

---

## 14. Decommissioning Supabase

Only after the VPS has served correctly for a few days, and only after §11's
restore test passed.

1. Take a final `pg_dump` and keep it somewhere that is not the VPS
2. Remove every `SUPABASE_*` variable from `.env` and from Netlify
3. Delete `supabase/migrations/` — the schema lives in §4.3 now
4. Pause rather than delete the Supabase project for the first month

---

## Still open after this

These do not block the move, but the move does not fix them either.

- **`support@ekjhalak.news` has no inbox.** Sending works; every reply bounces.
  A VPS can run its own MTA, but a forwarder (ImprovMX, Cloudflare Email
  Routing) is free and does not put your IP's sending reputation at stake.
- **Rate limiting is per-process.** On one VPS process that is now *better* than
  it was on Netlify Functions, where every request could meet an empty map. It
  is real on a single box. It stops being real the moment you run two.
- **Groq's free tier still governs enrichment.** Nothing about the hosting
  changes 200,000 tokens a day.
