import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/source-registry";
import { getCachedFeed } from "@/lib/aggregator";
import sql from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Get status from the latest cached feed — no fresh fetch triggered here
  const sourceStatuses: Record<
    string,
    { ok: boolean; itemCount: number; fetchedAt: number; error?: string }
  > = {};

  // Try DB for last-fetch status first (more accurate)
  if (process.env.DATABASE_URL) {
    try {
      const rows = await sql<
        {
          id: string;
          lastFetchedAt: string | null;
          lastError: string | null;
          articleCount: number;
        }[]
      >`
        SELECT
          s.id,
          s.last_fetched_at,
          s.last_error,
          COUNT(a.id)::int AS article_count
        FROM sources s
        LEFT JOIN articles a ON a.source_id = s.id
          AND a.published_at > NOW() - INTERVAL '24 hours'
        GROUP BY s.id, s.last_fetched_at, s.last_error
      `;
      for (const row of rows) {
        sourceStatuses[row.id] = {
          ok: !row.lastError,
          itemCount: row.articleCount,
          fetchedAt: row.lastFetchedAt
            ? new Date(row.lastFetchedAt).getTime()
            : 0,
          error: row.lastError ?? undefined,
        };
      }
    } catch {
      // Fall through to in-memory fallback
    }
  }

  // Fallback: use the in-memory aggregator statuses
  if (Object.keys(sourceStatuses).length === 0) {
    try {
      const feed = await getCachedFeed();
      for (const s of feed.sourceStatuses) {
        sourceStatuses[s.id] = {
          ok: s.ok,
          itemCount: s.itemCount,
          fetchedAt: s.fetchedAt,
          error: s.error,
        };
      }
    } catch {
      // Return source list without status
    }
  }

  const sources = SOURCES.map((source) => {
    const status = sourceStatuses[source.id];
    return {
      id: source.id,
      name: source.name,
      bucket: source.bucket,
      country: source.country,
      language: source.language,
      categories: source.categories,
      homepageUrl: source.homepageUrl,
      priority: source.priority,
      active: source.active,
      hasRss: source.rssUrl !== null,
      note: source.note,
      status: status ?? null,
    };
  });

  return NextResponse.json(
    { sources },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
