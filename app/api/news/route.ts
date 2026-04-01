import { NextRequest, NextResponse } from "next/server";
import { getCachedFeed } from "@/lib/aggregator";
import type { RangeKey } from "@/lib/news-pipeline";

// Range → lookback window in milliseconds
const RANGE_CUTOFFS: Record<RangeKey, number> = {
  day: 24 * 60 * 60 * 1000, // 24 hours
  week: 7 * 24 * 60 * 60 * 1000, // 7 days
  month: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // Note: request.nextUrl.searchParams is a synchronous URLSearchParams in Route Handlers.
  // Async searchParams applies only to page/layout component props in Next.js 16.

  const rawRange = searchParams.get("range") ?? "day";
  if (!["day", "week", "month"].includes(rawRange)) {
    return NextResponse.json(
      { error: "Invalid range parameter" },
      { status: 400 },
    );
  }
  const range = rawRange as RangeKey;

  const bucket = searchParams.get("bucket") ?? "all";
  const rawLimit = parseInt(searchParams.get("limit") ?? "100", 10);
  const limit = Number.isNaN(rawLimit) ? 100 : Math.min(rawLimit, 500);

  // Get aggregated feed (cached up to 10 minutes)
  let feed;
  try {
    feed = await getCachedFeed();
  } catch (err) {
    console.error("[api/news] getCachedFeed failed:", err);
    return NextResponse.json(
      {
        error: "Feed unavailable",
        items: [],
        meta: { total: 0, fetchedAt: Date.now(), sourceStatuses: [] },
      },
      { status: 503 },
    );
  }

  const cutoffMs = RANGE_CUTOFFS[range];
  const since = feed.fetchedAt - cutoffMs;

  // Filter by time range
  let items = feed.items.filter((item) => item.publishedTimestamp >= since);

  // Filter by bucket
  if (bucket === "national") {
    items = items.filter((item) => item.bucket === "national");
  } else if (bucket === "international") {
    items = items.filter((item) => item.bucket === "international");
  }

  // Items are already sorted newest-first from the aggregator
  const sliced = items.slice(0, limit);

  return NextResponse.json({
    items: sliced,
    meta: {
      total: items.length,
      fetchedAt: feed.fetchedAt,
      sourceStatuses: feed.sourceStatuses,
    },
  });
}
