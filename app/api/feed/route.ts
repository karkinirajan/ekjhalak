// app/api/feed/route.ts
// Canonical public feed endpoint.
// Falls back to the in-memory aggregator when no DATABASE_URL is set.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryFeed, type RangeKey, type ScopeKey } from "@/lib/feed/queries";
import { serializeArticles, type ApiArticle } from "@/lib/feed/serializers";
import { getCachedFeed } from "@/lib/aggregator";
import type { NewsItem } from "@/lib/news-pipeline";
import { isSummaryWithinRange } from "@/lib/translator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  lang: z.enum(["en", "np"]).optional().default("en"),
  scope: z.enum(["all", "national", "international"]).optional().default("all"),
  window: z.enum(["day", "week", "month"]).optional().default("day"),
  source: z.string().max(80).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  q: z.string().max(200).optional(),
});

type FeedResponse = {
  articles: ApiArticle[];
  total: number;
  page: number;
  pageSize: number;
  fetchedAt: number;
};

function newsItemToApiArticle(item: NewsItem, idx: number): ApiArticle {
  const isNp = item.originalLang === "np";
  const originalSummary = isNp ? item.summaryNp : item.summaryEn;
  const originalBrief = isNp ? item.briefNp : item.briefEn;
  const effectiveSummary = originalBrief || originalSummary || "";
  const summary = isSummaryWithinRange(effectiveSummary)
    ? effectiveSummary
    : "";

  return {
    id: item.id ?? String(idx),
    sourceId: item.sourceId ?? "unknown",
    sourceName: item.source ?? item.sourceId ?? "Unknown",
    scope: item.bucket ?? "national",
    url: item.sourceUrl,
    title: item.title,
    titleNp: null,
    titleEn: null,
    summary: summary || null,
    summaryNp: isNp ? summary || null : null,
    summaryEn: isNp ? null : summary || null,
    briefEn: isNp ? null : (item.briefEn ?? null),
    briefNp: isNp ? (item.briefNp ?? null) : null,
    imageUrl: item.imageUrl ?? null,
    publishedAt:
      typeof item.publishedAt === "string"
        ? item.publishedAt
        : new Date(item.publishedTimestamp ?? Date.now()).toISOString(),
    publishedTimestamp: item.publishedTimestamp ?? Date.now(),
    language: isNp ? "np" : "en",
    category: item.category ?? null,
    score: 0,
    clusterId: null,
    alternateSourceIds: item.alternateSourceIds ?? [],
  };
}

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { lang, scope, window: range, source, page, q } = parsed.data;

  // ── DB path ───────────────────────────────────────────────────────────────
  if (process.env.DATABASE_URL) {
    try {
      const PAGE_SIZE = 30;
      const result = await queryFeed({
        range: range as RangeKey,
        scope: scope as ScopeKey,
        sourceId: source,
        lang,
        page,
        pageSize: PAGE_SIZE,
        search: q,
      });

      const body: FeedResponse = {
        articles: serializeArticles(result.articles),
        total: result.total,
        page,
        pageSize: PAGE_SIZE,
        fetchedAt: result.fetchedAt,
      };

      return NextResponse.json(body, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      });
    } catch (err) {
      console.error("[api/feed] DB error, falling back:", err);
      // fall through to in-memory fallback
    }
  }

  // ── In-memory fallback ────────────────────────────────────────────────────
  try {
    const feed = await getCachedFeed();
    let filtered: NewsItem[] = feed.items;

    if (scope !== "all") {
      filtered = filtered.filter((a) => (a.bucket ?? "national") === scope);
    }
    if (source) {
      filtered = filtered.filter((a) => a.sourceId === source);
    }
    if (q) {
      const lq = q.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(lq) ||
          (a.summaryEn ?? "").toLowerCase().includes(lq),
      );
    }

    const PAGE_SIZE = 30;
    const total = filtered.length;
    const sliced = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const body: FeedResponse = {
      articles: sliced.map(newsItemToApiArticle),
      total,
      page,
      pageSize: PAGE_SIZE,
      fetchedAt: Date.now(),
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[api/feed] Fallback error:", err);
    return NextResponse.json(
      { error: "Feed temporarily unavailable" },
      { status: 503 },
    );
  }
}
