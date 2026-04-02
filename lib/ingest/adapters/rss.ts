// lib/ingest/adapters/rss.ts
// RSS/Atom feed adapter — re-exports the core fetcher from lib/rss-adapter.ts.
// Thin wrapper so the canonical adapter path (lib/ingest/adapters/rss) is available
// for imports within the ingestion subsystem.

export { fetchRssFeed, type RawStory } from "@/lib/rss-adapter";
