-- 20260806010000_articles_retention.sql
-- Keeping the archive inside a 500 MB free tier without breaking permalinks.
--
-- `articles` only grows. Roughly 1,500 new stories a day survive dedup, and a
-- row carries up to two summaries — the original and its translation — so the
-- heavy columns are most of the weight. Left alone the table reaches the free
-- tier's ceiling in months, and the failure mode is writes starting to fail
-- silently, which is exactly the shape of failure this project has already been
-- bitten by twice.
--
-- The tension worth naming: retention and the archive's own purpose pull in
-- opposite directions. The table exists so a permalink outlives the feed window.
-- Deleting old rows re-breaks the thing it was built to fix.
--
-- So the default tool here is not deletion. `prune_article_bodies` strips the
-- text and keeps the row, which reclaims most of the bytes while `/story/{id}`
-- still resolves — headline, outlet, date, photograph and the outbound link to
-- the publisher, which is the part a reader actually needs. Real deletion exists
-- too, for when that is genuinely what you want, but it is the second option and
-- it is named so nobody runs it by accident.
--
-- Neither is scheduled. Both are functions you call, because how long this site
-- keeps its history is an editorial decision, not a default.

-- ── Reclaim bytes, keep the permalink ───────────────────────────────────────

create or replace function public.prune_article_bodies(retain_days integer default 180)
returns integer
language sql
security invoker
set search_path = public
as $$
  with pruned as (
    update public.articles
       set summary            = '',
           summary_translated = null
     where last_seen_at < now() - make_interval(days => retain_days)
       -- Only rows that still carry text, so repeated runs are no-ops rather
       -- than rewriting the whole tail of the table every time.
       and (summary <> '' or summary_translated is not null)
    returning 1
  )
  select coalesce(count(*), 0)::integer from pruned;
$$;

comment on function public.prune_article_bodies(integer) is
  'Blank the summary columns on rows not seen for N days. The row, and therefore /story/{id}, survives. Returns rows touched.';

-- ── Actually delete ─────────────────────────────────────────────────────────

create or replace function public.delete_articles_older_than(retain_days integer default 730)
returns integer
language sql
security invoker
set search_path = public
as $$
  with deleted as (
    delete from public.articles
     where last_seen_at < now() - make_interval(days => retain_days)
       -- Never orphan a self-reference. A row that something else points at as
       -- its canonical stays until that pointer goes, whatever its age.
       and not exists (
         select 1 from public.articles child
          where child.canonical_id = articles.id
       )
    returning 1
  )
  select coalesce(count(*), 0)::integer from deleted;
$$;

comment on function public.delete_articles_older_than(integer) is
  'Delete rows not seen for N days, skipping any that are some other row''s canonical. This breaks their permalinks — prefer prune_article_bodies. Returns rows deleted.';

-- ── What the table currently costs ──────────────────────────────────────────
--
-- So the decision above can be made from a number rather than a guess. Read it
-- before deciding whether either function needs running at all.

create or replace function public.article_storage()
returns table (
  rows            bigint,
  oldest_seen     timestamptz,
  newest_seen     timestamptz,
  total_size      text,
  bytes_per_row   integer,
  rows_with_text  bigint
)
language sql
security invoker
set search_path = public
as $$
  select
    count(*)                                                          as rows,
    min(last_seen_at)                                                 as oldest_seen,
    max(last_seen_at)                                                 as newest_seen,
    pg_size_pretty(pg_total_relation_size('public.articles'))         as total_size,
    (pg_total_relation_size('public.articles')
      / greatest(count(*), 1))::integer                               as bytes_per_row,
    count(*) filter (where summary <> '')                             as rows_with_text
  from public.articles;
$$;

comment on function public.article_storage() is
  'One row: size, age range and text-carrying count for public.articles. Read this before pruning.';

-- ── Access ──────────────────────────────────────────────────────────────────
--
-- `security invoker`, deliberately — these run with the caller's rights, not the
-- definer's. Combined with the revokes below, that means they are reachable by
-- the service role and from the SQL editor, and not by `anon` or `authenticated`
-- through PostgREST's RPC endpoint. A function that empties columns should not
-- be one HTTP request away from the public internet.

revoke all on function public.prune_article_bodies(integer) from public, anon, authenticated;
revoke all on function public.delete_articles_older_than(integer) from public, anon, authenticated;
revoke all on function public.article_storage() from public, anon, authenticated;
