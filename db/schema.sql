-- db/schema.sql
--
-- The whole schema, dumped from the running database. Apply with:
--
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- ── Articles are kept forever ───────────────────────────────────────────────
--
-- There is no retention policy, and its absence is a decision rather than an
-- oversight. Nothing in this file or in lib/ deletes a row: the writer is an
-- INSERT … ON CONFLICT DO UPDATE, so a story seen again updates in place and
-- one seen once stays.
--
-- The Supabase schema this replaced shipped two functions that did delete —
-- delete_articles_older_than(retain_days default 730) and
-- prune_article_bodies(retain_days default 180). Neither was ever applied here
-- and both are deliberately absent. If a retention policy is ever wanted, it
-- should arrive as its own migration that someone had to write, not as a
-- function sitting in the schema waiting for a cron entry.
--
-- It is affordable. Measured on the live table: 5,302 bytes a row including
-- indexes, against about 161 new stories a day.
--
--     1 year      58,765 rows      0.3 GB
--     5 years    293,825 rows      1.5 GB
--    10 years    587,650 rows      2.9 GB
--    20 years  1,175,300 rows      5.8 GB
--
-- The 42 GB free on this box is roughly 144 years of it. Disk is not the reason
-- to throw away an archive that cost real money in model tokens to build.

--
-- PostgreSQL database dump
--

\restrict oOpqrNHzgMZ8dUH4RCUPdBObzO60V4h4eedBdOQcqy6LCv9kGXvm0JOQxNc58EB

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id text NOT NULL,
    source_url text NOT NULL,
    source_id text NOT NULL,
    source_name text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    original_lang text NOT NULL,
    title_translated text,
    summary_translated text,
    bucket text,
    topic text,
    category text,
    credibility text,
    image_url text,
    published_at timestamp with time zone,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    coverage_count integer DEFAULT 1 NOT NULL,
    alternate_source_ids text[] DEFAULT '{}'::text[] NOT NULL,
    canonical_id text,
    enrichment_key text,
    quality jsonb
);


--
-- Name: subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscribers (
    id bigint NOT NULL,
    email text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    unsubscribed_at timestamp with time zone,
    source_ip inet,
    user_agent text,
    CONSTRAINT subscribers_language_check CHECK ((language = ANY (ARRAY['en'::text, 'np'::text]))),
    CONSTRAINT subscribers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'unsubscribed'::text, 'bounced'::text])))
);


--
-- Name: subscribers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscribers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscribers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscribers_id_seq OWNED BY public.subscribers.id;


--
-- Name: subscription_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_events (
    id bigint NOT NULL,
    subscriber_id bigint,
    event text NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    detail jsonb,
    CONSTRAINT subscription_events_event_check CHECK ((event = ANY (ARRAY['requested'::text, 'confirmed'::text, 'unsubscribed'::text, 'bounced'::text, 'resent'::text])))
);


--
-- Name: subscription_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_events_id_seq OWNED BY public.subscription_events.id;


--
-- Name: subscribers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscribers ALTER COLUMN id SET DEFAULT nextval('public.subscribers_id_seq'::regclass);


--
-- Name: subscription_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events ALTER COLUMN id SET DEFAULT nextval('public.subscription_events_id_seq'::regclass);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: subscribers subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscribers
    ADD CONSTRAINT subscribers_email_key UNIQUE (email);


--
-- Name: subscribers subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscribers
    ADD CONSTRAINT subscribers_pkey PRIMARY KEY (id);


--
-- Name: subscription_events subscription_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_pkey PRIMARY KEY (id);


--
-- Name: articles_coverage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articles_coverage_idx ON public.articles USING btree (coverage_count DESC);


--
-- Name: articles_enrichment_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articles_enrichment_key_idx ON public.articles USING btree (enrichment_key) WHERE (enrichment_key IS NOT NULL);


--
-- Name: articles_last_seen_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articles_last_seen_at_idx ON public.articles USING btree (last_seen_at DESC);


--
-- Name: articles_published_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articles_published_at_idx ON public.articles USING btree (published_at DESC);


--
-- Name: subscribers_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscribers_status_idx ON public.subscribers USING btree (status) WHERE (status = 'confirmed'::text);


--
-- Name: subscription_events_subscriber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscription_events_subscriber_idx ON public.subscription_events USING btree (subscriber_id, at DESC);


--
-- Name: subscription_events subscription_events_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.subscribers(id) ON DELETE CASCADE;


--
-- Name: digest_deliveries; Type: TABLE; Schema: public; Owner: -
--
-- Added by hand, not part of the dump above it: the daily digest's delivery
-- ledger, one row per subscriber per digest date (lib/digest-store.ts). It is
-- what lets the cron run more than once a morning without mailing anyone twice.
-- Placed last because it references subscribers, whose primary key is created
-- above. Re-dump this file from a database that has it applied to replace this
-- block.
--

CREATE TABLE public.digest_deliveries (
    digest_date date NOT NULL,
    subscriber_id bigint NOT NULL,
    status text NOT NULL,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    error text,
    CONSTRAINT digest_deliveries_status_check CHECK ((status = ANY (ARRAY['sending'::text, 'sent'::text, 'failed'::text]))),
    CONSTRAINT digest_deliveries_pkey PRIMARY KEY (digest_date, subscriber_id),
    CONSTRAINT digest_deliveries_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.subscribers(id) ON DELETE CASCADE
);


--
-- Name: digest_deliveries_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX digest_deliveries_date_status_idx ON public.digest_deliveries USING btree (digest_date, status);


--
-- PostgreSQL database dump complete
--

\unrestrict oOpqrNHzgMZ8dUH4RCUPdBObzO60V4h4eedBdOQcqy6LCv9kGXvm0JOQxNc58EB

