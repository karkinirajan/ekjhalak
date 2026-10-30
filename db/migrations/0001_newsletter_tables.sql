-- db/migrations/0001_newsletter_tables.sql
--
-- The subscriber list: `subscribers` (what is true now) and `subscription_events`
-- (what happened). Mirrors db/schema.sql, for a database that already has
-- `articles` and does not have these.
--
-- Safe to re-run: every statement is IF NOT EXISTS or idempotent.
--
-- Apply with either
--   psql "$DATABASE_URL" -f db/migrations/0001_newsletter_tables.sql
-- or by pasting into the Supabase SQL editor
--   https://supabase.com/dashboard/project/_/sql/new

CREATE TABLE IF NOT EXISTS public.subscribers (
    id bigserial PRIMARY KEY,
    email text NOT NULL UNIQUE,
    language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'np')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed', 'bounced')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    unsubscribed_at timestamptz,
    source_ip inet,
    user_agent text
);

CREATE INDEX IF NOT EXISTS subscribers_status_idx
    ON public.subscribers (status) WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS public.subscription_events (
    id bigserial PRIMARY KEY,
    subscriber_id bigint REFERENCES public.subscribers (id) ON DELETE CASCADE,
    event text NOT NULL CHECK (event IN ('requested', 'confirmed', 'unsubscribed', 'bounced', 'resent')),
    at timestamptz NOT NULL DEFAULT now(),
    detail jsonb
);

CREATE INDEX IF NOT EXISTS subscription_events_subscriber_idx
    ON public.subscription_events (subscriber_id, at DESC);

-- These tables hold email addresses and IPs. Supabase exposes every table in
-- `public` through its REST API to the anon key unless row level security is on.
-- The app connects as the table owner (`postgres` on Supabase), which is not
-- subject to RLS, so enabling it with no policies shuts the REST API and leaves
-- the app untouched.
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- `anon` and `authenticated` exist on Supabase only; skipped elsewhere.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.subscribers, public.subscription_events FROM anon, authenticated;
        REVOKE ALL ON SEQUENCE public.subscribers_id_seq, public.subscription_events_id_seq FROM anon, authenticated;
    END IF;
END
$$;
