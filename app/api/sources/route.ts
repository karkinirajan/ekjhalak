import { NextResponse } from "next/server"
import { SOURCES } from "@/lib/source-registry"
import { getCachedFeed } from "@/lib/aggregator"

export async function GET() {
  // Get status from the latest cached feed — no fresh fetch triggered here
  let sourceStatuses: Record<string, { ok: boolean; itemCount: number; fetchedAt: number; error?: string }> = {}

  try {
    const feed = await getCachedFeed()
    console.log(`[api/sources] feed ok, ${feed.sourceStatuses.length} statuses`)
    for (const s of feed.sourceStatuses) {
      sourceStatuses[s.id] = {
        ok: s.ok,
        itemCount: s.itemCount,
        fetchedAt: s.fetchedAt,
        error: s.error,
      }
    }
  } catch {
    // If feed is unavailable, return source list without status
  }

  const sources = SOURCES.map((source) => {
    const status = sourceStatuses[source.id]
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
      // Live status (only present for active sources that have been fetched)
      status: status ?? null,
    }
  })

  return NextResponse.json({ sources })
}
