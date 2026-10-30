-- db/migrations/0002_digest_deliveries.sql
--
-- The daily digest's delivery ledger: one row per subscriber per digest date.
-- It is what lets the cron run several times a morning without mailing anyone
-- twice (see lib/digest-store.ts).
--
-- Requires 0001 (it references public.subscribers). Safe to re-run.
--
-- Apply with either
--   psql "$DATABASE_URL" -f db/migrations/0002_digest_deliveries.sql
-- or by pasting into the Supabase SQL editor
--   https://supabase.com/dashboard/project/_/sql/new

CREATE TABLE IF NOT EXISTS public.digest_deliveries (
    digest_date date NOT NULL,
    subscriber_id bigint NOT NULL REFERENCES public.subscribers (id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
    attempted_at timestamptz NOT NULL DEFAULT now(),
    error text,
    PRIMARY KEY (digest_date, subscriber_id)
);

CREATE INDEX IF NOT EXISTS digest_deliveries_date_status_idx
    ON public.digest_deliveries (digest_date, status);

-- Names subscribers, so it stays off Supabase's REST API, as in 0001.
ALTER TABLE public.digest_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.digest_deliveries FROM anon, authenticated;
    END IF;
END
$$;
