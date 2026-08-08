-- 20260808000000_articles_enrichment.sql
-- Two columns that turn the archive from a write-only record into a cache.
--
-- The table as first written stored what a story *said*. It did not store what
-- had already been *spent* to find that out, and that omission is the whole
-- reason this site has never been bilingual.
--
-- The arithmetic, measured on 2026-08-06: the Gemini free tier gives this key
-- 1,060 requests a day across the five-model chain. At a batch size of 10 that
-- is 10,600 story-slots, against roughly 1,500 new stories a day surviving
-- dedup — a comfortable surplus. Yet production served 0 translations of 200
-- items, because lib/enrichment-cache.ts is a process-local Map: every cold
-- serverless invocation starts empty, the feed regenerates 288 times a day, and
-- each pass re-translates stories that were already translated. The allowance is
-- sufficient and was being spent entirely on work already done.
--
-- `enrichment_key` is what closes that loop. It is the same key the in-process
-- cache uses — the story id plus an FNV-1a hash of the exact text that was sent
-- to the model — so a row can answer "has this been enriched, from this source
-- text?" without trusting that the id alone means the story is unchanged. A
-- publisher who rewrites a body under the same URL, which several of them do
-- within the first hour of a breaking story, produces a different key and gets a
-- fresh translation rather than a stale one served forever.
--
-- The archive therefore becomes the L2 behind that Map's L1, and the two share
-- one key format on purpose. See lib/enrichment-cache.ts and the hydrate stage
-- in lib/aggregator.ts.

alter table public.articles
  -- Nullable, and null on every row written before this migration. A null key
  -- can never equal a computed one, so pre-existing rows are simply cache misses
  -- and are re-enriched once, at which point they gain a key. No backfill is
  -- possible and none is needed: the text that produced those translations was
  -- not recorded, so there is nothing to compute the key from.
  add column if not exists enrichment_key text,

  -- The verdicts from lib/text-audit.ts and the model verification pass, in the
  -- shape of StoryQuality: { audited, bilingual, verified?, note? }.
  --
  -- jsonb rather than three columns because only one field here is worth
  -- persisting and the other two must not be. `audited` and `bilingual` are
  -- recomputed for free on every hydrate — they are deterministic functions of
  -- text this table already holds, and recomputing them means a row written by
  -- an older, weaker audit gets re-checked instead of grandfathered in.
  -- `verified` is the one that cannot be recomputed without spending a model
  -- request, which makes it the one worth storing.
  --
  -- Deliberately unconstrained. A check constraint here would mean a migration
  -- every time the audit gains a code, and a failed insert in production the
  -- moment code shipped ahead of one — the same reasoning that left `topic` and
  -- `category` as plain text.
  add column if not exists quality jsonb;

comment on column public.articles.enrichment_key is
  'Story id + FNV-1a hash of the text sent to the model. Matches enrichmentKey() in lib/enrichment-cache.ts; a mismatch means the publisher edited the body and the translation must be redone.';
comment on column public.articles.quality is
  'StoryQuality as written by the audit and verification stages. Only `verified` is trusted on read — the rest is recomputed.';

-- No index on enrichment_key, deliberately.
--
-- It is never a search term. The hydrate stage selects by `id in (…)`, which is
-- the primary key, and compares the key in application code after the rows come
-- back. An index would be a write cost paid on every upsert forever to serve a
-- query nobody makes — the same argument the original migration made against
-- indexing source_id.
