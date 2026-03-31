import { NextRequest, NextResponse } from "next/server"
import { demoData, type RangeKey } from "@/lib/news-pipeline"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const rawRange = searchParams.get("range") ?? "day"
  const bucket = searchParams.get("bucket") ?? "all"
  const rawLimit = parseInt(searchParams.get("limit") ?? "100", 10)
  const limit = Number.isNaN(rawLimit) ? 100 : Math.min(rawLimit, 200)

  if (!["day", "week", "month"].includes(rawRange)) {
    return NextResponse.json({ error: "Invalid range parameter" }, { status: 400 })
  }

  const range = rawRange as RangeKey
  const rangeData = demoData[range]
  const items =
    bucket === "national"
      ? rangeData.national
      : bucket === "international"
        ? rangeData.international
        : [...rangeData.national, ...rangeData.international]

  return NextResponse.json({ items: items.slice(0, limit) })
}
