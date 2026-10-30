import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { bearerToken, isCronAuthorized } from "@/lib/cron-auth";

/**
 * On-demand cache invalidation for the news feed.
 *
 * Two callers, two credentials:
 *
 *   GET   Vercel Cron. The platform sends `Authorization: Bearer $CRON_SECRET`
 *         on every scheduled invocation, and it only ever issues GET — so a
 *         POST-only route could not have served the schedule even if the
 *         schedule had pointed here. It pointed at `/api/cron/enrich`, a route
 *         that has never existed in this repo, and 404'd daily.
 *
 *   POST  Anything else trusted, authenticated with `?secret=`.
 *
 * Both fail closed. The previous implementation skipped the check entirely when
 * REVALIDATE_SECRET was unset — "allow freely (dev/staging)" — which meant a
 * forgotten environment variable did not break the deploy, it published an
 * unauthenticated cache-purge endpoint. A missing secret in production is now a
 * 401; only an explicitly non-production NODE_ENV opens the door.
 */

// The check itself lives in lib/cron-auth.ts, shared with every other scheduled
// route so the fail-closed rule above cannot drift between them.

function purge() {
  revalidateTag("news-feed", "max");
  return NextResponse.json({
    revalidated: true,
    tag: "news-feed",
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized("GET", bearerToken(request.headers))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return purge();
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!isCronAuthorized("POST", secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return purge();
}
