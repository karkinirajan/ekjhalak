// lib/ingest/cluster.ts
// Article clustering: assigns cluster keys to deduplicated articles so that
// multiple sources reporting the same story can be grouped and displayed together.
//
// Algorithm:
//  1. Within a 4-hour time window, group articles with Jaccard title similarity ≥ 0.55.
//  2. Each group elects a canonical article (highest score / source priority).
//  3. Cluster key = SHA-256 of the canonical article's URL fingerprint.
//  4. Results are persisted to article_clusters + article_cluster_members tables.
//
// This runs as a post-ingestion step — it does NOT block the ingestion loop.

import { createHash } from "node:crypto";
import { jaccardSimilarity } from "./dedup";

export const CLUSTER_THRESHOLD = 0.55;
export const CLUSTER_WINDOW_MS = 4 * 60 * 60 * 1_000; // 4 hours

export interface ClusterCandidate {
  id: string;
  title: string;
  publishedTimestamp: number;
  score: number;
  sourceId: string;
}

export interface ClusterGroup {
  /** SHA-256-derived cluster key */
  clusterKey: string;
  /** Article ID elected as canonical (highest score) */
  canonicalId: string;
  /** All member article IDs, including canonical */
  memberIds: string[];
  topScore: number;
}

/**
 * Cluster a list of articles into story groups.
 *
 * Returns ClusterGroup[] — one group per unique story.
 * Articles that don't cluster are returned as singleton groups.
 */
export function clusterArticles(articles: ClusterCandidate[]): ClusterGroup[] {
  // Sort by score desc so the first item seen in a cluster becomes canonical
  const sorted = [...articles].sort((a, b) => b.score - a.score);

  const groups: ClusterGroup[] = [];
  const assigned = new Set<string>();

  for (const article of sorted) {
    if (assigned.has(article.id)) continue;

    const members: ClusterCandidate[] = [article];
    assigned.add(article.id);

    for (const candidate of sorted) {
      if (assigned.has(candidate.id)) continue;

      const timeDiff = Math.abs(
        article.publishedTimestamp - candidate.publishedTimestamp,
      );
      if (timeDiff > CLUSTER_WINDOW_MS) continue;

      const sim = jaccardSimilarity(article.title, candidate.title);
      if (sim >= CLUSTER_THRESHOLD) {
        members.push(candidate);
        assigned.add(candidate.id);
      }
    }

    const canonical = members.reduce((best, m) =>
      m.score > best.score ? m : best,
    );

    const clusterKey = createHash("sha256")
      .update(canonical.id)
      .digest("hex")
      .slice(0, 16);

    groups.push({
      clusterKey,
      canonicalId: canonical.id,
      memberIds: members.map((m) => m.id),
      topScore: canonical.score,
    });
  }

  return groups;
}

/**
 * Quick helper: given a cluster key, return the matching group or null.
 */
export function findCluster(
  groups: ClusterGroup[],
  clusterKey: string,
): ClusterGroup | null {
  return groups.find((g) => g.clusterKey === clusterKey) ?? null;
}
