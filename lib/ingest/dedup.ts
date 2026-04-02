// lib/ingest/dedup.ts
// Re-exports deduplication utilities from lib/deduplicator.ts.
// Provides the canonical import path within the lib/ingest subsystem.

export { deduplicate, jaccardSimilarity } from "@/lib/deduplicator";
