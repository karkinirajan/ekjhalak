import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

/**
 * On-demand cache invalidation for the news feed.
 * Called by Vercel Cron or any trusted trigger.
 *
 * Protect with a secret token in production:
 *   POST /api/revalidate?secret=YOUR_REVALIDATE_SECRET
 *
 * Set REVALIDATE_SECRET in Vercel environment variables.
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const envSecret = process.env.REVALIDATE_SECRET;

  // If no secret is configured, allow freely (dev/staging).
  // In production, always set REVALIDATE_SECRET.
  if (envSecret && secret !== envSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag("news-feed", "max");

  return NextResponse.json({
    revalidated: true,
    tag: "news-feed",
    timestamp: new Date().toISOString(),
  });
}
