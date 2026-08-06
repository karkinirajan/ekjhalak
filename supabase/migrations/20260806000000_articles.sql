-- 20260806000000_articles.sql
-- The first durable record this project has kept of anything.
--
-- Until now every regeneration started from nothing: fetch 22 feeds, dedupe,
-- enrich what the budget reaches, serve, forget. A story that appeared at 09:00
-- and was rewritten at 11:00 was two unrelated events, and a story that fell out
-- of the window was gone. This table is the memory — one row per distinct story,
-- written on the way past, read by nothing on the request path yet.
--
-- It is deliberately not the feed's source of truth. `/api/news` still builds
-- from RSS and still works with this table empty or unreachable; the writes are
-- fire-and-forget behind a deadline (see lib/article-store.ts). Making the feed
-- depend on a read here is Phase 7's decision, and it should be made after there
-- is enough history to know the shape is right.

create table if not exists public.articles (
  -- The SHA-256 fingerprint of the normalized article URL, first 12 hex chars,
  -- computed in lib/feed-normalizer.ts. Already the identity every other part of
  -- this codebase uses to mean "this story", so the table adopts it rather than
  -- minting a surrogate key that would then need mapping in both directions.
  id text primary key,

  -- ── Where it came from ────────────────────────────────────────────────────
  source_url  text not null,
  source_id   text not null,
  source_name text not null,

  -- ── What it says, in the language its newsroom published it ───────────────
  -- The translated pair is nullable on purpose: a pass enriches as far as its
  -- budget reaches and no further, so a story can be stored before it has been
  -- translated and filled in by a later pass. Absent means "not yet", and the
  -- UI already treats it that way.
  title              text not null,
  summary            text not null default '',
  original_lang      text not null check (original_lang in ('np', 'en')),
  title_translated   text,
  summary_translated text,

  -- ── How it is filed ───────────────────────────────────────────────────────
  -- topic and category are unconstrained text rather than enums. The taxonomy
  -- lives in lib/taxonomy.ts and changes with editorial judgement; an enum here
  -- would mean a migration every time a topic is added, and a failed insert in
  -- production the moment code shipped ahead of one.
  bucket      text not null check (bucket in ('national', 'international')),
  topic       text not null,
  category    text,
  credibility smallint check (credibility between 1 and 10),
  image_url   text,

  -- ── Time ──────────────────────────────────────────────────────────────────
  -- published_at is the newsroom's claim. first_seen_at is ours, and it is the
  -- one to trust: publishers backdate, restate and occasionally lie about when
  -- something went up, and a story cannot have been seen before we saw it.
  published_at  timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  -- ── Who else ran it ───────────────────────────────────────────────────────
  -- coverage_count is how many distinct outlets carried the story;
  -- alternate_source_ids is which ones. Both are computed in lib/deduplicator.ts
  -- at the only moment they exist — the duplicate rows are discarded immediately
  -- after.
  coverage_count      smallint not null default 1 check (coverage_count >= 1),
  alternate_source_ids text[] not null default '{}',

  -- Reserved, and null on every row today. Duplicates are dropped inside
  -- `deduplicate` rather than stored pointing at their survivor, so nothing can
  -- populate this yet. It is here because adding a self-referencing foreign key
  -- to a populated table later is a far more careful operation than declaring it
  -- on an empty one, and because the column being visible and empty is a more
  -- honest record of the design than its absence.
  canonical_id text references public.articles(id) on delete set null
);

comment on table public.articles is
  'One row per distinct story. Written fire-and-forget by the aggregator; not read on the request path.';
comment on column public.articles.id is
  'SHA-256 of the normalized article URL, first 12 hex chars. Matches NewsItem.id.';
comment on column public.articles.first_seen_at is
  'When this aggregator first saw the story. Trustworthy in a way published_at is not.';
comment on column public.articles.canonical_id is
  'Reserved. Null on every row until duplicates are persisted rather than discarded.';

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- Three, for the three questions this table exists to answer. No index on
-- source_id: the whole table is smaller than a single feed regeneration's
-- working set for a long while yet, and an unused index is a write cost paid on
-- every upsert forever.

-- "what was published recently" — the archive, and any future backfill of /api/news
create index if not exists articles_published_at_idx
  on public.articles (published_at desc);

-- "what is still live" — a story stops being re-seen when it falls out of every
-- feed, which is the only signal this system gets that it is no longer current
create index if not exists articles_last_seen_at_idx
  on public.articles (last_seen_at desc);

-- "what was the most-covered story of the day" — the coverage-comparison wedge
create index if not exists articles_coverage_idx
  on public.articles (coverage_count desc, published_at desc)
  where coverage_count > 1;

-- ── Row-level security ──────────────────────────────────────────────────────
-- Enabled with no policies, which denies anon and authenticated outright. That
-- is the intended posture: nothing in the browser reads this table, and the
-- writer authenticates with the service role, which bypasses RLS by design.
--
-- Enabling RLS and adding no policy is a deliberate deny-all, not an oversight.
-- If a reader-facing feature ever needs this data, it gets a policy written for
-- that feature — not a blanket `using (true)` added here in advance.
alter table public.articles enable row level security;
