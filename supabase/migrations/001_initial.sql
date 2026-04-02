-- supabase/migrations/001_initial.sql
-- Ekjhalak v1 — initial production schema
-- Run with: supabase db push  OR  psql $DATABASE_URL -f supabase/migrations/001_initial.sql
-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
-- gen_random_uuid()
create extension if not exists "pg_trgm";
-- trigram text search
create extension if not exists "unaccent";
-- accent-insensitive search
-- ── Custom types ─────────────────────────────────────────────────────────────
do $$ begin if not exists (
  select 1
  from pg_type
  where typname = 'source_scope'
) then create type source_scope as enum ('national', 'international');
end if;
end $$;
do $$ begin if not exists (
  select 1
  from pg_type
  where typname = 'source_language'
) then create type source_language as enum ('en', 'np', 'multi');
end if;
end $$;
do $$ begin if not exists (
  select 1
  from pg_type
  where typname = 'source_type'
) then create type source_type as enum ('rss', 'api', 'scrape');
end if;
end $$;
do $$ begin if not exists (
  select 1
  from pg_type
  where typname = 'parse_status'
) then create type parse_status as enum ('pending', 'ok', 'error');
end if;
end $$;
do $$ begin if not exists (
  select 1
  from pg_type
  where typname = 'translation_status'
) then create type translation_status as enum ('pending', 'ok', 'error', 'skipped');
end if;
end $$;
do $$ begin if not exists (
  select 1
  from pg_type
  where typname = 'rewrite_style'
) then create type rewrite_style as enum ('brief', 'readable');
end if;
end $$;
do $$ begin if not exists (
  select 1
  from pg_type
  where typname = 'subscriber_status'
) then create type subscriber_status as enum ('active', 'unsubscribed', 'bounced');
end if;
end $$;
-- ── sources ───────────────────────────────────────────────────────────────────
create table if not exists sources (
  id text primary key,
  name text not null,
  slug text not null unique,
  scope source_scope not null,
  language source_language not null default 'en',
  country char(2) not null default 'NP',
  homepage_url text not null,
  rss_url text,
  api_url text,
  source_type source_type not null default 'rss',
  active boolean not null default true,
  credibility_weight smallint not null default 5 check (
    credibility_weight between 1 and 10
  ),
  poll_interval_minutes smallint not null default 15,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  logo_url text,
  url_prefix_filter text,
  priority smallint not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sources_active on sources (active);
create index if not exists idx_sources_scope on sources (scope);
-- ── articles_raw ─────────────────────────────────────────────────────────────
-- Raw ingest records — one row per fetched item. Never modified after insert.
create table if not exists articles_raw (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references sources (id) on delete cascade,
  source_item_id text,
  source_url text not null,
  source_payload_json jsonb not null default '{}',
  fetched_at timestamptz not null default now(),
  published_at timestamptz,
  checksum char(64) not null,
  -- SHA-256 hex
  parse_status parse_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (source_id, checksum)
);
create index if not exists idx_articles_raw_source_id on articles_raw (source_id);
create index if not exists idx_articles_raw_fetched_at on articles_raw (fetched_at desc);
create index if not exists idx_articles_raw_checksum on articles_raw (checksum);
-- ── articles ─────────────────────────────────────────────────────────────────
-- Normalised, deduplicated article records. One row per canonical story.
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references sources (id) on delete cascade,
  canonical_url text not null,
  title_original text not null,
  summary_original text,
  author text,
  image_url text,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  language source_language not null default 'en',
  category text,
  region text,
  fingerprint char(64) not null unique,
  -- SHA-256 of normalised URL
  cluster_id uuid references article_clusters (id) on delete
  set null,
    score real not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_articles_published_at on articles (published_at desc);
create index if not exists idx_articles_source_id on articles (source_id, published_at desc);
create index if not exists idx_articles_fingerprint on articles (fingerprint);
create index if not exists idx_articles_cluster_id on articles (cluster_id);
create index if not exists idx_articles_language on articles (language);
create index if not exists idx_articles_score on articles (score desc);
create index if not exists idx_articles_category on articles (category);
-- Full-text search on title + summary
create index if not exists idx_articles_fts on articles using gin (
  to_tsvector(
    'english',
    coalesce(title_original, '') || ' ' || coalesce(summary_original, '')
  )
);
-- ── article_clusters ─────────────────────────────────────────────────────────
-- Deduplicated story groups. Created forward-decl above; define body here.
create table if not exists article_clusters (
  id uuid primary key default gen_random_uuid(),
  canonical_article_id uuid not null,
  -- FK added after articles table exists
  cluster_key text not null unique,
  top_score real not null default 0,
  story_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Add FK now that articles exists
do $$ begin if not exists (
  select 1
  from information_schema.table_constraints
  where constraint_name = 'article_clusters_canonical_article_id_fkey'
) then
alter table article_clusters
add constraint article_clusters_canonical_article_id_fkey foreign key (canonical_article_id) references articles (id) on delete cascade;
end if;
end $$;
create index if not exists idx_article_clusters_canonical on article_clusters (canonical_article_id);
create index if not exists idx_article_clusters_key on article_clusters (cluster_key);
create index if not exists idx_article_clusters_updated on article_clusters (updated_at desc);
-- ── article_cluster_members ───────────────────────────────────────────────────
create table if not exists article_cluster_members (
  cluster_id uuid not null references article_clusters (id) on delete cascade,
  article_id uuid not null references articles (id) on delete cascade,
  source_id text not null references sources (id) on delete cascade,
  primary key (cluster_id, article_id)
);
create index if not exists idx_acm_cluster_id on article_cluster_members (cluster_id);
create index if not exists idx_acm_article_id on article_cluster_members (article_id);
-- ── translations ─────────────────────────────────────────────────────────────
create table if not exists translations (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles (id) on delete cascade,
  lang char(2) not null,
  translated_title text,
  translated_summary text,
  provider text,
  status translation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, lang)
);
create index if not exists idx_translations_article_id on translations (article_id);
create index if not exists idx_translations_status on translations (status);
create index if not exists idx_translations_lang on translations (lang);
-- ── rewrites ─────────────────────────────────────────────────────────────────
create table if not exists rewrites (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles (id) on delete cascade,
  lang char(2) not null,
  style rewrite_style not null,
  title text,
  summary text,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, lang, style)
);
create index if not exists idx_rewrites_article_id on rewrites (article_id);
-- ── ingest_runs ───────────────────────────────────────────────────────────────
create table if not exists ingest_runs (
  id uuid primary key default gen_random_uuid(),
  interval_minutes smallint not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  sources_attempted integer not null default 0,
  sources_succeeded integer not null default 0,
  sources_failed integer not null default 0,
  new_items integer not null default 0,
  updated_items integer not null default 0,
  deduped_items integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ingest_runs_started_at on ingest_runs (started_at desc);
-- ── ingest_errors ─────────────────────────────────────────────────────────────
create table if not exists ingest_errors (
  id uuid primary key default gen_random_uuid(),
  source_id text references sources (id) on delete
  set null,
    run_id uuid references ingest_runs (id) on delete
  set null,
    stage text not null,
    error_message text not null,
    error_meta_json jsonb not null default '{}',
    created_at timestamptz not null default now()
);
create index if not exists idx_ingest_errors_source_id on ingest_errors (source_id);
create index if not exists idx_ingest_errors_run_id on ingest_errors (run_id);
create index if not exists idx_ingest_errors_created on ingest_errors (created_at desc);
-- ── subscribers ───────────────────────────────────────────────────────────────
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  preferred_language source_language not null default 'en',
  status subscriber_status not null default 'active',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscribers_email on subscribers (email);
create index if not exists idx_subscribers_status on subscribers (status);
-- ── updated_at auto-update trigger ───────────────────────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now();
return new;
end;
$$;
do $$
declare t text;
begin foreach t in array array ['sources','articles','article_clusters','translations','rewrites','subscribers'] loop if not exists (
  select 1
  from information_schema.triggers
  where trigger_name = 'trg_' || t || '_updated_at'
) then execute format(
  'create trigger trg_%1$s_updated_at before update on %1$s for each row execute function set_updated_at()',
  t
);
end if;
end loop;
end $$;
-- ── Supabase Cron setup (pg_cron) ────────────────────────────────────────────
-- These cron jobs call the ingestion endpoint via pg_net.
-- Uncomment and configure AFTER deployment; replace the URL with your Vercel domain.
--
-- select cron.schedule(
--   'ingest-15min',
--   '*/15 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://YOUR_DOMAIN/api/admin/ingest/run',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-ingest-hmac', 'YOUR_HMAC_SIGNATURE'
--     ),
--     body    := '{"trigger":"cron"}'::jsonb
--   );
--   $$
-- );
